package com.db.dbworld.audit.tracking.aggregate;

import java.util.ArrayList;
import java.util.List;

/** Serializes a coalesced set of inclusive byte intervals as "s:e,s:e". */
public final class RangeIntervals {

    private static final int MAX_INTERVALS = 128;

    private RangeIntervals() {}

    public static String add(String existing, List<long[]> newRanges) {
        List<long[]> all = new ArrayList<>(parse(existing));
        if (newRanges != null) all.addAll(newRanges);
        List<long[]> merged = coalesce(all);
        if (merged.size() > MAX_INTERVALS) merged = capIntervals(merged);
        StringBuilder sb = new StringBuilder();
        for (long[] iv : merged) {
            if (sb.length() > 0) sb.append(',');
            sb.append(iv[0]).append(':').append(iv[1]);
        }
        return sb.toString();
    }

    public static long covered(String serialized) {
        return TransferMath.coveredBytes(parse(serialized));
    }

    private static List<long[]> parse(String s) {
        List<long[]> out = new ArrayList<>();
        if (s == null || s.isBlank()) return out;
        for (String part : s.split(",")) {
            int c = part.indexOf(':');
            if (c <= 0) continue;
            out.add(new long[]{Long.parseLong(part.substring(0, c)), Long.parseLong(part.substring(c + 1))});
        }
        return out;
    }

    private static List<long[]> coalesce(List<long[]> intervals) {
        List<long[]> out = new ArrayList<>();
        if (intervals.isEmpty()) return out;
        intervals.sort((a, b) -> Long.compare(a[0], b[0]));
        long s = intervals.get(0)[0], e = intervals.get(0)[1];
        for (int i = 1; i < intervals.size(); i++) {
            long[] iv = intervals.get(i);
            if (iv[0] <= e + 1) { if (iv[1] > e) e = iv[1]; }
            else { out.add(new long[]{s, e}); s = iv[0]; e = iv[1]; }
        }
        out.add(new long[]{s, e});
        return out;
    }

    /**
     * Reduces a sorted, coalesced interval list to at most MAX_INTERVALS entries by
     * repeatedly merging the adjacent pair with the smallest gap. Only ever over-counts
     * covered bytes (by the merged gaps), never under-counts.
     */
    private static List<long[]> capIntervals(List<long[]> merged) {
        List<long[]> result = new ArrayList<>(merged);
        while (result.size() > MAX_INTERVALS) {
            int bestIdx = 0;
            long bestGap = Long.MAX_VALUE;
            for (int i = 0; i < result.size() - 1; i++) {
                long gap = result.get(i + 1)[0] - result.get(i)[1];
                if (gap < bestGap) {
                    bestGap = gap;
                    bestIdx = i;
                }
            }
            long[] a = result.get(bestIdx);
            long[] b = result.get(bestIdx + 1);
            long[] mergedPair = {a[0], Math.max(a[1], b[1])};
            result.set(bestIdx, mergedPair);
            result.remove(bestIdx + 1);
        }
        return result;
    }
}
