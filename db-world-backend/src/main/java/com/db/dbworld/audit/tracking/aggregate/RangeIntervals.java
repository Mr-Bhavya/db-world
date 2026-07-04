package com.db.dbworld.audit.tracking.aggregate;

import java.util.ArrayList;
import java.util.List;

/** Serializes a coalesced set of inclusive byte intervals as "s:e,s:e". */
public final class RangeIntervals {

    private RangeIntervals() {}

    public static String add(String existing, List<long[]> newRanges) {
        List<long[]> all = new ArrayList<>(parse(existing));
        if (newRanges != null) all.addAll(newRanges);
        List<long[]> merged = coalesce(all);
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
}
