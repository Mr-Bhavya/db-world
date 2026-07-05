package com.db.dbworld.audit.tracking.aggregate;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class RangeIntervalsTest {
    @Test void addAndCover_dedupesOverlap() {
        String s = RangeIntervals.add(null, List.of(new long[]{0, 1023}));
        s = RangeIntervals.add(s, List.of(new long[]{512, 2047}));
        assertThat(RangeIntervals.covered(s)).isEqualTo(2048);
    }
    @Test void covered_emptyOrNull_isZero() {
        assertThat(RangeIntervals.covered(null)).isEqualTo(0);
        assertThat(RangeIntervals.covered("")).isEqualTo(0);
    }
    @Test void serializedFormat_isCompactAndCoalesced() {
        String s = RangeIntervals.add(null, List.of(new long[]{0, 99}, new long[]{100, 199}));
        assertThat(s).isEqualTo("0:199");           // adjacent -> coalesced
        assertThat(RangeIntervals.covered(s)).isEqualTo(200);
    }
    @org.junit.jupiter.api.Test void addManyDisjointIntervals_isCappedButCoversAtLeastTrueUnion() {
        String s = null;
        long trueUnion = 0;
        for (int i = 0; i < 500; i++) {           // 500 disjoint 10-byte ranges, gap 90
            long start = i * 100L;
            s = RangeIntervals.add(s, java.util.List.of(new long[]{start, start + 9}));
            trueUnion += 10;
        }
        int intervalCount = s.isEmpty() ? 0 : s.split(",").length;
        org.assertj.core.api.Assertions.assertThat(intervalCount).isLessThanOrEqualTo(128);
        org.assertj.core.api.Assertions.assertThat(RangeIntervals.covered(s)).isGreaterThanOrEqualTo(trueUnion);
    }
}
