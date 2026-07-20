package com.db.dbworld.audit.tracking.aggregate;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class TransferMathTest {

    @Test void coveredBytes_singleInterval_isInclusiveLength() {
        assertThat(TransferMath.coveredBytes(List.of(new long[]{0, 1023}))).isEqualTo(1024);
    }

    @Test void coveredBytes_overlappingIntervals_countedOnce() {
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{0, 1023}, new long[]{512, 2047}))).isEqualTo(2048);
    }

    @Test void coveredBytes_adjacentIntervals_merge() {
        // 0-1023 and 1024-2047 are adjacent -> one 2048-byte run
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{0, 1023}, new long[]{1024, 2047}))).isEqualTo(2048);
    }

    @Test void coveredBytes_gap_notCounted() {
        // 0-99 (100) + gap + 200-299 (100) = 200
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{0, 99}, new long[]{200, 299}))).isEqualTo(200);
    }

    @Test void coveredBytes_outOfOrderAndDuplicate() {
        assertThat(TransferMath.coveredBytes(List.of(
                new long[]{200, 299}, new long[]{0, 99}, new long[]{0, 99}))).isEqualTo(200);
    }

    @Test void coveredBytes_empty_isZero() {
        assertThat(TransferMath.coveredBytes(List.of())).isEqualTo(0);
    }

    @Test void peakConcurrent_nonOverlapping_isOne() {
        assertThat(TransferMath.peakConcurrent(List.of(
                new long[]{0, 10}, new long[]{20, 30}))).isEqualTo(1);
    }

    @Test void peakConcurrent_threeOverlap_isThree() {
        assertThat(TransferMath.peakConcurrent(List.of(
                new long[]{0, 100}, new long[]{10, 50}, new long[]{20, 40}))).isEqualTo(3);
    }

    @Test void peakConcurrent_empty_isZero() {
        assertThat(TransferMath.peakConcurrent(List.of())).isEqualTo(0);
    }
}
