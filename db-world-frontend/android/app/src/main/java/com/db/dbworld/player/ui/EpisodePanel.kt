package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Right-side drawer: episode list (current highlighted) + quality options. Scrim dismiss. */
@Composable
fun EpisodePanel(
    state: PlayerUiState,
    onSelectEpisode: (String) -> Unit,
    onSelectQuality: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onDismiss)) {
        Column(
            Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(320.dp)
                .background(Color(0xF21B1B1F)).padding(16.dp).verticalScroll(rememberScrollState()),
        ) {
            if (state.episodes.isNotEmpty()) {
                Text("Episodes", color = Color(0xFF9AA0A6), fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 6.dp))
                state.episodes.forEach { ep ->
                    val sel = ep.fileId == state.currentFileId
                    Text(
                        ep.label,
                        color = if (sel) Color(0xFF14B8A6) else Color.White,
                        fontSize = 15.sp,
                        fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.fillMaxWidth().clickable { onSelectEpisode(ep.fileId) }.padding(vertical = 10.dp),
                    )
                }
            }
            if (state.variants.isNotEmpty()) {
                Text("Quality", color = Color(0xFF9AA0A6), fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
                state.variants.forEach { v ->
                    Text(v.label, color = Color.White, fontSize = 15.sp,
                        modifier = Modifier.fillMaxWidth().clickable { onSelectQuality(v.url) }.padding(vertical = 10.dp))
                }
            }
        }
    }
}
