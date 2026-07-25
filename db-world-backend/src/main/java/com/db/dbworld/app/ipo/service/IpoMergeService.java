package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoDto;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

/**
 * Collapses per-source {@link IpoDto} rows (one per source per IPO, tagged with
 * {@code matchKey == null}) into one merged dto per IPO, keyed by
 * {@link IpoNormalizer#matchKey(IpoDto)}.
 *
 * <p>Each field is resolved by an EXPLICIT precedence list of source keys — never by the
 * incoming list order, which is meaningless (the source registry preserves Spring bean order,
 * not any curated reliability order).
 */
@Log4j2
@Component
public class IpoMergeService {

    /** Dates/status/pricing: NSE is the exchange of record, so it wins ties. */
    private static final List<String> PRECEDENCE_PRIMARY = List.of("nse", "ipoguru", "chittorgarh");

    /** GMP/subscription: IPO Guru tracks these most actively/frequently. */
    private static final List<String> PRECEDENCE_VOLATILE = List.of("ipoguru", "chittorgarh", "nse");

    /** Allotment/registrar/listing-gain: Chittorgarh is the most complete for these. */
    private static final List<String> PRECEDENCE_REGISTRAR = List.of("chittorgarh", "ipoguru", "nse");

    private final IpoNormalizer normalizer;

    public IpoMergeService(IpoNormalizer normalizer) {
        this.normalizer = normalizer;
    }

    public List<IpoDto> merge(List<IpoDto> dtos) {
        Map<String, List<IpoDto>> groups = new LinkedHashMap<>();
        for (IpoDto dto : dtos) {
            String key = normalizer.matchKey(dto);
            if (key == null) {
                continue;
            }
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(dto);
        }

        List<IpoDto> merged = new ArrayList<>(groups.size());
        for (Map.Entry<String, List<IpoDto>> entry : groups.entrySet()) {
            merged.add(mergeGroup(entry.getKey(), entry.getValue()));
        }
        return merged;
    }

    private IpoDto mergeGroup(String matchKey, List<IpoDto> group) {
        Picked<String> companyName = pick(group, PRECEDENCE_PRIMARY, IpoDto::companyName, "companyName");
        Picked<String> ipoType = pick(group, PRECEDENCE_PRIMARY, IpoDto::ipoType, "ipoType");
        Picked<String> status = pick(group, PRECEDENCE_PRIMARY, IpoDto::status, "status");
        Picked<LocalDate> openDate = pick(group, PRECEDENCE_PRIMARY, IpoDto::openDate, "openDate");
        Picked<LocalDate> closeDate = pick(group, PRECEDENCE_PRIMARY, IpoDto::closeDate, "closeDate");
        Picked<LocalDate> allotmentDate = pick(group, PRECEDENCE_PRIMARY, IpoDto::allotmentDate, "allotmentDate");
        Picked<LocalDate> listingDate = pick(group, PRECEDENCE_PRIMARY, IpoDto::listingDate, "listingDate");
        Picked<LocalDate> refundDate = pick(group, PRECEDENCE_PRIMARY, IpoDto::refundDate, "refundDate");
        Picked<LocalDate> dematDate = pick(group, PRECEDENCE_PRIMARY, IpoDto::dematDate, "dematDate");
        Picked<BigDecimal> priceMin = pick(group, PRECEDENCE_PRIMARY, IpoDto::priceMin, "priceMin");
        Picked<BigDecimal> priceMax = pick(group, PRECEDENCE_PRIMARY, IpoDto::priceMax, "priceMax");
        Picked<Integer> lotSize = pick(group, PRECEDENCE_PRIMARY, IpoDto::lotSize, "lotSize");
        Picked<String> issueSize = pick(group, PRECEDENCE_PRIMARY, IpoDto::issueSize, "issueSize");
        Picked<String> listingExchange = pick(group, PRECEDENCE_PRIMARY, IpoDto::listingExchange, "listingExchange");
        Picked<BigDecimal> listingPrice = pick(group, PRECEDENCE_PRIMARY, IpoDto::listingPrice, "listingPrice");
        Picked<String> logoUrl = pick(group, PRECEDENCE_PRIMARY, IpoDto::logoUrl, "logoUrl");
        Picked<String> about = pick(group, PRECEDENCE_PRIMARY, IpoDto::about, "about");
        Picked<BigDecimal> faceValue = pick(group, PRECEDENCE_PRIMARY, IpoDto::faceValue, "faceValue");
        Picked<BigDecimal> freshIssue = pick(group, PRECEDENCE_PRIMARY, IpoDto::freshIssue, "freshIssue");
        Picked<BigDecimal> offerForSale = pick(group, PRECEDENCE_PRIMARY, IpoDto::offerForSale, "offerForSale");
        Picked<String> tickerSymbol = pick(group, PRECEDENCE_PRIMARY, IpoDto::tickerSymbol, "tickerSymbol");
        Picked<String> strengths = pick(group, PRECEDENCE_PRIMARY, IpoDto::strengths, "strengths");
        Picked<String> risks = pick(group, PRECEDENCE_PRIMARY, IpoDto::risks, "risks");

        Picked<BigDecimal> gmp = pick(group, PRECEDENCE_VOLATILE, IpoDto::gmp, "gmp");
        Picked<BigDecimal> gmpPct = pick(group, PRECEDENCE_VOLATILE, IpoDto::gmpPct, "gmpPct");
        Picked<Map<String, BigDecimal>> subscriptionCategories =
                pick(group, PRECEDENCE_VOLATILE, IpoDto::subscriptionCategories, "subscriptionCategories");
        Picked<BigDecimal> subTotal = pick(group, PRECEDENCE_VOLATILE, IpoDto::subTotal, "subTotal");

        Picked<String> allotmentStatus = pick(group, PRECEDENCE_REGISTRAR, IpoDto::allotmentStatus, "allotmentStatus");
        Picked<BigDecimal> listingGainPct = pick(group, PRECEDENCE_REGISTRAR, IpoDto::listingGainPct, "listingGainPct");
        Picked<String> registrar = pick(group, PRECEDENCE_REGISTRAR, IpoDto::registrar, "registrar");
        Picked<String> registrarUrl = pick(group, PRECEDENCE_REGISTRAR, IpoDto::registrarUrl, "registrarUrl");

        // The merged dto carries a single `source`, but its fields came from up to three sources.
        // Downstream (IpoIngestService) only reads dto.source() to stamp GMP/subscription history
        // rows, so we attribute it to whichever source actually supplied the GMP value (falling
        // back to subTotal's source, then any source in the group) rather than an arbitrary pick.
        String source = firstNonNull(gmp.source(), subTotal.source(), companyName.source(), group.get(0).source());

        return new IpoDto(source, matchKey, companyName.value(), ipoType.value(), status.value(),
                openDate.value(), closeDate.value(), allotmentDate.value(), listingDate.value(),
                priceMin.value(), priceMax.value(), lotSize.value(), issueSize.value(),
                listingExchange.value(), listingPrice.value(), listingGainPct.value(),
                gmp.value(), gmpPct.value(), subscriptionCategories.value(), subTotal.value(),
                allotmentStatus.value(), registrar.value(), registrarUrl.value(), logoUrl.value(), about.value(),
                refundDate.value(), dematDate.value(), faceValue.value(), freshIssue.value(), offerForSale.value(),
                tickerSymbol.value(), strengths.value(), risks.value());
    }

    @SafeVarargs
    private static String firstNonNull(String... values) {
        for (String v : values) {
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    /**
     * Resolves one field for a match group: try each source in {@code precedence} in order,
     * take the first non-null value; if none of those sources supplied it, fall back to any
     * non-null value present in the group. Logs (DEBUG) every other non-null, differing value
     * that got discarded.
     */
    private <T> Picked<T> pick(List<IpoDto> group, List<String> precedence, Function<IpoDto, T> getter, String fieldName) {
        Map<String, IpoDto> bySource = new LinkedHashMap<>();
        for (IpoDto d : group) {
            bySource.putIfAbsent(d.source(), d);
        }

        T chosen = null;
        String chosenSource = null;
        for (String src : precedence) {
            IpoDto d = bySource.get(src);
            if (d == null) {
                continue;
            }
            T value = getter.apply(d);
            if (value != null) {
                chosen = value;
                chosenSource = src;
                break;
            }
        }
        if (chosen == null) {
            for (IpoDto d : group) {
                T value = getter.apply(d);
                if (value != null) {
                    chosen = value;
                    chosenSource = d.source();
                    break;
                }
            }
        }

        if (chosen != null && log.isDebugEnabled()) {
            for (IpoDto d : group) {
                if (Objects.equals(d.source(), chosenSource)) {
                    continue;
                }
                T value = getter.apply(d);
                if (value != null && differs(value, chosen)) {
                    log.debug("IPO merge conflict: field={} chosenValue={} chosenSource={} discardedValue={} discardedSource={}",
                            fieldName, chosen, chosenSource, value, d.source());
                }
            }
        }
        return new Picked<>(chosen, chosenSource);
    }

    private static boolean differs(Object a, Object b) {
        if (a instanceof BigDecimal ba && b instanceof BigDecimal bb) {
            return ba.compareTo(bb) != 0;
        }
        return !Objects.equals(a, b);
    }

    private record Picked<T>(T value, String source) {}
}
