package com.db.dbworld.app.cinema.editorial;

import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.service.CatalogService;
import com.db.dbworld.app.cinema.common.events.RecordChangedEvent;
import com.db.dbworld.app.cinema.review.dto.UserReviewDto;
import com.db.dbworld.app.cinema.review.service.UserReviewService;
import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Log4j2
@Service
@RequiredArgsConstructor
public class RecordEditorialAiService {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String SYSTEM_PROMPT = """
            You write useful, original editorial context for a movie and TV catalogue.
            Use only facts in the supplied JSON. Never invent awards, plot events, cast,
            availability, file quality, audience reaction, or critical consensus.
            Reviews are supplied only to infer broad themes; never quote or closely
            paraphrase them. Do not repeat the supplied synopsis or use promotional
            language. Keep the result factual, spoiler-light, and specific to this title.
            """;

    private final CatalogService catalogService;
    private final RecordRepository recordRepository;
    private final UserReviewService reviewService;
    private final ApplicationEventPublisher publisher;
    private final SettingsService settingsService;
    @Qualifier("recordEditorialAiWebClient")
    private final WebClient webClient;

    public String model() {
        return settingsService.getString(ConfigKeys.CINEMA_AI_EDITORIAL_MODEL);
    }

    public OllamaStatus status() {
        String baseUrl = settingsService.getString(ConfigKeys.CINEMA_AI_EDITORIAL_BASE_URL);
        String configuredModel = model();
        try {
            ListModelsResponse response = webClient.get()
                    .uri(baseUrl + "/api/tags")
                    .retrieve()
                    .bodyToMono(ListModelsResponse.class)
                    .block(Duration.ofSeconds(10));
            boolean available = response != null
                    && response.models().stream().anyMatch(item -> configuredModel.equals(item.name()));
            return new OllamaStatus(available, baseUrl, configuredModel, available
                    ? "Ollama and the configured model are ready."
                    : "Ollama is reachable, but the configured model is not installed.");
        } catch (Exception error) {
            return new OllamaStatus(false, baseUrl, configuredModel, error.getMessage());
        }
    }

    @Transactional
    public RecordDto generate(Long recordId, boolean overwrite) {
        RecordDto record = catalogService.getRecord(recordId);
        RecordEntity entity = recordRepository.findById(recordId)
                .orElseThrow(() -> new EntityNotFoundException("Record not found: " + recordId));

        if (!overwrite
                && "MANUAL".equalsIgnoreCase(entity.getEditorialSource())
                && entity.getEditorialNote() != null
                && !entity.getEditorialNote().isBlank()) {
            throw new DbWorldException(
                    HttpStatus.CONFLICT,
                    "This record has manually written editorial content. Confirm regeneration to replace it.");
        }

        List<UserReviewDto> reviews = reviewService.getByRecord(recordId, null);
        String prompt = buildPrompt(record, reviews);
        GeneratedEditorial generated = requestEditorial(prompt);
        validate(generated.editorialNote());

        entity.setEditorialNote(generated.editorialNote());
        entity.setEditorialSource("AI");
        entity.setEditorialModel(model());
        entity.setAiVerdict(generated.verdict());
        entity.setAiQualityScore(generated.qualityScore());
        entity.setAiBestFor(generated.bestFor());
        entity.setAiConsiderations(generated.considerations());
        entity.setEditorialUpdatedAt(Instant.now());
        recordRepository.save(entity);
        publisher.publishEvent(new RecordChangedEvent(recordId));

        log.info("AI editorial generated: recordId={}, model={}, chars={}",
                recordId, model(), generated.editorialNote().length());
        return catalogService.getRecord(recordId);
    }

    GeneratedEditorial requestEditorial(String prompt) {
        OllamaChatResponse response = webClient.post()
                .uri(settingsService.getString(ConfigKeys.CINEMA_AI_EDITORIAL_BASE_URL) + "/api/chat")
                .bodyValue(new OllamaChatRequest(
                        model(),
                        "json",
                        false,
                        List.of(
                                new Message("system", SYSTEM_PROMPT),
                                new Message("user", prompt)),
                        new Options(0.25, 500)))
                .retrieve()
                .onStatus(status -> status.isError(), result -> result.bodyToMono(String.class)
                        .flatMap(body -> Mono.error(new DbWorldException(
                                HttpStatus.BAD_GATEWAY,
                                "Ollama generation failed: " + body))))
                .bodyToMono(OllamaChatResponse.class)
                .block(Duration.ofSeconds(
                        settingsService.getInt(ConfigKeys.CINEMA_AI_EDITORIAL_TIMEOUT_SECONDS)));

        if (response == null || response.message() == null
                || response.message().content() == null || response.message().content().isBlank()) {
            throw new DbWorldException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Ollama returned no editorial content.");
        }

        try {
            JsonNode parsed = JSON.readTree(response.message().content());
            String note = parsed.path("editorialNote").stringValue();
            String verdict = parsed.path("verdict").stringValue();
            String bestFor = parsed.path("bestFor").stringValue();
            String considerations = parsed.path("considerations").stringValue();
            Integer score = parsed.path("qualityScore").isIntegralNumber()
                    ? parsed.path("qualityScore").intValue()
                    : null;
            GeneratedEditorial result = new GeneratedEditorial(
                    note == null ? "" : note.trim(),
                    normaliseVerdict(verdict),
                    score,
                    bestFor == null ? null : bestFor.trim(),
                    considerations == null ? null : considerations.trim());
            validateSignals(result);
            return result;
        } catch (Exception error) {
            throw new DbWorldException(
                    HttpStatus.BAD_GATEWAY,
                    "Ollama returned invalid JSON; no content was saved.",
                    error);
        }
    }

    String buildPrompt(RecordDto record, List<UserReviewDto> reviews) {
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("type", record.getType());
        facts.put("title", record.getTmdb() == null ? record.getName() : record.getTmdb().getTitle());
        facts.put("overview", record.getTmdb() == null ? null : record.getTmdb().getOverview());
        facts.put("tagline", record.getTmdb() == null ? null : record.getTmdb().getTagline());
        facts.put("genres", record.getTmdb() == null || record.getTmdb().getGenres() == null
                ? List.of()
                : record.getTmdb().getGenres().stream().map(g -> g.getName()).toList());
        facts.put("originalLanguage", record.getTmdb() == null ? null : record.getTmdb().getOriginalLanguage());
        facts.put("certification", record.getTmdb() == null ? null : record.getTmdb().getCertification());
        facts.put("tmdbRating", record.getTmdb() == null ? null : record.getTmdb().getVoteAverage());
        facts.put("tmdbVoteCount", record.getTmdb() == null ? null : record.getTmdb().getVoteCount());
        facts.put("dbWorldAvailability", record.getAvailability());
        facts.put("dbWorldReviewCount", reviews.size());
        facts.put("dbWorldAverageRating", reviews.isEmpty() ? null
                : reviews.stream().mapToInt(UserReviewDto::getRating).average().orElse(0));
        facts.put("publicReviewThemes", reviews.stream()
                .filter(review -> review.getContent() != null && !review.getContent().isBlank())
                .sorted((a, b) -> Integer.compare(
                        b.getRating(),
                        a.getRating()))
                .limit(8)
                .map(review -> Map.of(
                        "rating", review.getRating(),
                        "text", truncate(review.getContent(), 600)))
                .toList());
        facts.put("tmdbReviewSnippets", record.getTmdb() == null || record.getTmdb().getReviews() == null
                ? List.of()
                : record.getTmdb().getReviews().stream()
                    .filter(review -> review.getContent() != null)
                    .limit(6)
                    .map(review -> Map.of("text", truncate(review.getContent(), 600)))
                    .toList());

        try {
            return """
                    Write 3-4 short paragraphs as a useful "DB World take".
                    Cover: (1) what kind of experience to expect, (2) who it is best for,
                    (3) a cautious audience-rating/review interpretation, and (4) DB World
                    availability when it is genuinely useful.
                    Use 400-900 non-whitespace characters. Do not repeat the overview.
                    Return only valid JSON with keys:
                    editorialNote, verdict (WORTH_WATCHING, MAY_ENJOY, SKIP_FOR_NOW, or NOT_ENOUGH_DATA),
                    qualityScore (integer 0-100, a conservative evidence confidence score—not a user rating),
                    bestFor (one short sentence), and considerations (one cautious sentence).
                    Never label something DO_NOT_WATCH; use SKIP_FOR_NOW only when supplied facts
                    indicate a poor availability or audience fit.

                    FACTS:
                    %s
                    """.formatted(JSON.writeValueAsString(facts));
        } catch (Exception error) {
            throw new DbWorldException("Failed to prepare editorial facts", error);
        }
    }

    void validate(String editorial) {
        long meaningful = editorial.codePoints()
                .filter(codePoint -> !Character.isWhitespace(codePoint))
                .count();
        if (meaningful < RecordEntity.MIN_INDEXABLE_EDITORIAL_LENGTH) {
            throw new DbWorldException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "Generated editorial content was too short and was not saved.");
        }

        if (editorial.length() > 5000) {
            throw new DbWorldException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "Generated editorial content exceeded 5,000 characters and was not saved.");
        }
    }

    private static void validateSignals(GeneratedEditorial generated) {
        if (generated.qualityScore() != null
                && (generated.qualityScore() < 0 || generated.qualityScore() > 100)) {
            throw new DbWorldException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "Generated AI quality score was outside 0-100 and was not saved.");
        }
        if (generated.bestFor() != null && generated.bestFor().length() > 1200
                || generated.considerations() != null && generated.considerations().length() > 1200) {
            throw new DbWorldException(
                    HttpStatus.UNPROCESSABLE_CONTENT,
                    "Generated AI summary was too long and was not saved.");
        }
    }

    private static String normaliseVerdict(String value) {
        if (value == null) return "NOT_ENOUGH_DATA";
        return switch (value.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "WORTH_WATCHING", "MAY_ENJOY", "SKIP_FOR_NOW" ->
                    value.trim().toUpperCase(java.util.Locale.ROOT);
            default -> "NOT_ENOUGH_DATA";
        };
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) return value;
        return value.substring(0, max);
    }

    private record OllamaChatRequest(
            String model,
            String format,
            boolean stream,
            List<Message> messages,
            Options options) {
    }

    private record Message(String role, String content) {
    }

    private record Options(double temperature, int num_predict) {
    }

    private record OllamaChatResponse(Message message) {
    }

    private record ListModelsResponse(List<ModelItem> models) {
    }

    private record ModelItem(String name) {
    }

    public record OllamaStatus(
            boolean ready,
            String baseUrl,
            String model,
            String message) {
    }

    record GeneratedEditorial(
            String editorialNote,
            String verdict,
            Integer qualityScore,
            String bestFor,
            String considerations) {
    }
}
