package com.db.dbworld.audit.tracking.aggregate;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Pure math for transfer accounting. Byte intervals are INCLUSIVE [start,end]. */
public final class TransferMath {

    private TransferMath() {}

    /** Union length of inclusive byte intervals (dedupes overlaps / re-requests). */
    public static long coveredBytes(List<long[]> intervals) {
        if (intervals == null || intervals.isEmpty()) return 0L;
        List<long[]> sorted = new ArrayList<>(intervals);
        sorted.sort((a, b) -> Long.compare(a[0], b[0]));
        long covered = 0L;
        long curStart = sorted.get(0)[0];
        long curEnd   = sorted.get(0)[1];
        for (int i = 1; i < sorted.size(); i++) {
            long[] iv = sorted.get(i);
            if (iv[0] <= curEnd + 1) {              // overlapping or adjacent
                if (iv[1] > curEnd) curEnd = iv[1];
            } else {
                covered += (curEnd - curStart + 1);
                curStart = iv[0];
                curEnd   = iv[1];
            }
        }
        covered += (curEnd - curStart + 1);
        return covered;
    }

    /** Peak number of time intervals overlapping at any instant (sweep-line). */
    public static int peakConcurrent(List<long[]> timeIntervals) {
        if (timeIntervals == null || timeIntervals.isEmpty()) return 0;
        long[] starts = new long[timeIntervals.size()];
        long[] ends   = new long[timeIntervals.size()];
        for (int i = 0; i < timeIntervals.size(); i++) {
            starts[i] = timeIntervals.get(i)[0];
            ends[i]   = timeIntervals.get(i)[1];
        }
        Arrays.sort(starts);
        Arrays.sort(ends);
        int peak = 0, current = 0, si = 0, ei = 0;
        while (si < starts.length) {
            if (starts[si] <= ends[ei]) { current++; if (current > peak) peak = current; si++; }
            else { current--; ei++; }
        }
        return peak;
    }
}
