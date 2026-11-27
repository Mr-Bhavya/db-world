package com.db.dbworld.app.ipo.ai;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;

@Service
public class IpoAiAnalysisService {

    public static final String JOB_ID = "IpoAiAnalysis";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String SYSTEM = """
            You are a cautious Indian IPO data analyst. Use only supplied facts.
            This is general information, not investment advice. Do not promise
            allotment or listing gains, and do not present GMP as reliable price discovery.
            Treat GMP and grey-market indicators as unofficial, volatile signals.
            Distinguish strong demand from fundamentals and explicitly mention uncertainty.
            """;

    private final IpoListingRepository repository;
    private final SettingsService settings;
    private final WebClient webClient;

    public IpoAiAnalysisService(
            IpoListingRepository repository,
            SettingsService settings,
            @Qualifier("recordEditorialAiWebClient") WebClient webClient) {
        this.repository = repository;
        this.settings = settings;
        this.webClient = webClient;
    }

    @Transactional
    public IpoListingEntity generate(String id) {
        IpoListingEntity ipo = repository.findById(id)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "IPO not found"));
        IpoListingEntity survivor = ipo.getMergedIntoId() == null
                ? ipo
                : repository.findById(ipo.getMergedIntoId())
                    .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "IPO not found"));

        String prompt = prompt(survivor);
        Generated result = request(prompt);
        if (!hasMinimumAnalysisLength(result.analysis())) {
            result = request("""
                    The previous analysis was too short. Expand ONLY analysis into
                    500-900 non-whitespace characters, retain all uncertainty, and
                    return the complete JSON object again without commentary.

                    ORIGINAL TASK:
                    %s
                    """.formatted(prompt));
        }
        if (!hasMinimumAnalysisLength(result.analysis())) {
            throw new DbWorldException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "Generated IPO analysis was too short and was not saved.");
        }
        if (result.confidenceScore() < 0 || result.confidenceScore() > 100) {
            throw new DbWorldException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "Generated IPO confidence score was invalid and was not saved.");
        }

        survivor.setAiAnalysis(result.analysis());
        survivor.setAiView(normaliseView(result.view()));
        survivor.setAiConfidenceScore(result.confidenceScore());
        survivor.setAiUpdatedAt(Instant.now());
        survivor.setAiModel(settings.getString(ConfigKeys.CINEMA_AI_EDITORIAL_MODEL));
        survivor.setAiSourceFingerprint(survivor.aiSourceFingerprint());
        return repository.save(survivor);
    }

    public void run(JobRunSummary.Builder summary) {
        int batch = settings.getInt(ConfigKeys.CINEMA_AI_EDITORIAL_BATCH_SIZE);
        List<IpoListingEntity> candidates = repository.findAll().stream()
                .filter(ipo -> ipo.getMergedIntoId() == null
                        && (ipo.getAiAnalysis() == null || ipo.isAiAnalysisStale()))
                .sorted(Comparator.comparing(
                                (IpoListingEntity ipo) -> ipo.getAiAnalysis() != null)
                        .thenComparing(
                                IpoListingEntity::getFirstSeenAt,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(IpoListingEntity::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(Math.max(1, batch))
                .toList();
        summary.count("selected", candidates.size())
                .count("generated", 0)
                .count("stale", (int) candidates.stream()
                        .filter(IpoListingEntity::isAiAnalysisStale)
                        .count())
                .note("Ollama model: " + settings.getString(ConfigKeys.CINEMA_AI_EDITORIAL_MODEL)
                        + "; newest IPOs without analysis first, then stale analysis");
        int generated = 0;
        int failed = 0;
        for (IpoListingEntity ipo : candidates) {
            try {
                generate(ipo.getId());
                summary.count("generated", ++generated);
            } catch (DbWorldException error) {
                if (error.getHttpStatus().value() != 422) throw error;
                summary.count("failed", ++failed)
                        .note("IPO " + ipo.getId() + " skipped: " + error.getMessage());
            }
        }
    }

    Generated request(String prompt) {
        ChatResponse response = webClient.post()
                .uri(settings.getString(ConfigKeys.CINEMA_AI_EDITORIAL_BASE_URL) + "/api/chat")
                .bodyValue(new ChatRequest(
                        settings.getString(ConfigKeys.CINEMA_AI_EDITORIAL_MODEL),
                        "json",
                        false,
                        List.of(new Message("system", SYSTEM), new Message("user", prompt)),
                        new Options(0.2, 1400)))
                .retrieve()
                .bodyToMono(ChatResponse.class)
                .block(Duration.ofSeconds(
                        settings.getInt(ConfigKeys.CINEMA_AI_EDITORIAL_TIMEOUT_SECONDS)));
        try {
            JsonNode json = JSON.readTree(response.message().content());
            return new Generated(
                    json.path("analysis").asString(""),
                    json.path("view").asString("NOT_ENOUGH_DATA"),
                    json.path("confidenceScore").intValue());
        } catch (Exception error) {
            throw new DbWorldException(HttpStatus.BAD_GATEWAY,
                    "Ollama returned invalid IPO JSON; no analysis was saved.", error);
        }
    }

    String prompt(IpoListingEntity ipo) {
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("company", ipo.getCompanyName());
        facts.put("sector", ipo.getSector());
        facts.put("type", ipo.getIpoType());
        facts.put("status", ipo.getStatus());
        facts.put("dates", List.of(ipo.getOpenDate(), ipo.getCloseDate(), ipo.getListingDate()));
        facts.put("priceRange", List.of(ipo.getPriceMin(), ipo.getPriceMax()));
        facts.put("freshIssue", ipo.getFreshIssue());
        facts.put("offerForSale", ipo.getOfferForSale());
        facts.put("peRatio", ipo.getPeRatio());
        facts.put("gmp", ipo.getGmp());
        facts.put("gmpPct", ipo.getGmpPct());
        facts.put("subscription", ipo.getSubTotal());
        facts.put("strengths", ipo.getStrengths());
        facts.put("risks", ipo.getRisks());
        facts.put("about", ipo.getAbout());
        facts.put("issueSize", ipo.getIssueSize());
        try {
            return """
                    Write 3 short sections: demand/market signals, business and valuation
                    considerations, and what a reader should verify before deciding.
                    Use 400-900 non-whitespace characters.
                    Return only JSON with: analysis, view
                    (APPLY, CONSIDER, WAIT, NOT_ENOUGH_DATA), confidenceScore (0-100 evidence confidence).
                    Never promise profit or allotment. Treat current GMP as unofficial.

                    FACTS:
                    %s
                    """.formatted(JSON.writeValueAsString(facts));
        } catch (Exception error) {
            throw new DbWorldException("Failed to prepare IPO facts", error);
        }
    }

    private static String normaliseView(String view) {
        return switch (view == null ? "" : view.trim().toUpperCase()) {
            case "APPLY", "CONSIDER", "WAIT" -> view.trim().toUpperCase();
            default -> "NOT_ENOUGH_DATA";
        };
    }

    private static boolean hasMinimumAnalysisLength(String analysis) {
        return analysis != null && analysis.codePoints()
                .filter(codePoint -> !Character.isWhitespace(codePoint))
                .count() >= IpoListingEntity.MIN_AI_ANALYSIS_LENGTH;
    }

    private record ChatRequest(
            String model, String format, boolean stream, List<Message> messages, Options options) {}
    private record Message(String role, String content) {}
    private record Options(double temperature, int num_predict) {}
    private record ChatResponse(Message message) {}
    record Generated(String analysis, String view, int confidenceScore) {}
}
