package com.db.dbworld.player

import android.view.Display.HdrCapabilities.HDR_TYPE_HDR10
import android.view.Display.HdrCapabilities.HDR_TYPE_HLG
import androidx.media3.common.C
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HdrSupportTest {
    @Test fun pqAndHlgAreHdr() {
        assertTrue(HdrSupport.isHdrTransfer(C.COLOR_TRANSFER_ST2084))
        assertTrue(HdrSupport.isHdrTransfer(C.COLOR_TRANSFER_HLG))
    }
    @Test fun sdrTransferIsNotHdr() {
        assertFalse(HdrSupport.isHdrTransfer(C.COLOR_TRANSFER_SDR))
    }
    @Test fun hdrContentOnSdrDisplayNeedsToneMap() {
        assertTrue(HdrSupport.needsToneMap(C.COLOR_TRANSFER_ST2084, IntArray(0)))
    }
    @Test fun hdrContentOnHdrDisplayDoesNotToneMap() {
        assertFalse(HdrSupport.needsToneMap(C.COLOR_TRANSFER_ST2084, intArrayOf(HDR_TYPE_HDR10)))
    }
    @Test fun sdrContentNeverToneMaps() {
        assertFalse(HdrSupport.needsToneMap(C.COLOR_TRANSFER_SDR, IntArray(0)))
    }
}
