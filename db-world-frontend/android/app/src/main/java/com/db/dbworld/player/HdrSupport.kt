package com.db.dbworld.player

import android.view.Display
import androidx.media3.common.C

/** Pure HDR decision helpers — no Android view state, so JVM-unit-testable. */
object HdrSupport {

    /** True for the two HDR transfer functions we passthrough/tone-map: PQ (HDR10/10+) and HLG. */
    fun isHdrTransfer(colorTransfer: Int): Boolean =
        colorTransfer == C.COLOR_TRANSFER_ST2084 || colorTransfer == C.COLOR_TRANSFER_HLG

    /**
     * Tone-map is needed only when the content is HDR AND the display does not advertise a
     * matching HDR type. PQ maps to HDR10/HDR10+; HLG maps to HLG.
     */
    fun needsToneMap(colorTransfer: Int, displaySupportedHdrTypes: IntArray): Boolean {
        if (!isHdrTransfer(colorTransfer)) return false
        val wanted = when (colorTransfer) {
            C.COLOR_TRANSFER_ST2084 -> intArrayOf(
                Display.HdrCapabilities.HDR_TYPE_HDR10,
                Display.HdrCapabilities.HDR_TYPE_HDR10_PLUS)
            else -> intArrayOf(Display.HdrCapabilities.HDR_TYPE_HLG)
        }
        return wanted.none { it in displaySupportedHdrTypes }
    }
}
