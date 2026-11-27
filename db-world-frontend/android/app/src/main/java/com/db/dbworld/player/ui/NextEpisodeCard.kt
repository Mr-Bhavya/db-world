package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * Shown when playback ends and a next episode exists. 10s countdown → onPlayNext.
 * The next episode is derived from [state.episodes] + [state.currentFileId] here.
 */
@Composable
fun NextEpisodeCard(
    state: PlayerUiState,
    onPlayNext: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    if (!state.ended) return
    val idx = state.episodes.indexOfFirst { it.fileId == state.currentFileId }
    val next = if (idx >= 0 && idx + 1 < state.episodes.size) state.episodes[idx + 1] else null
    if (next == null) return

    var secs by remember(next.fileId) { mutableIntStateOf(10) }
    LaunchedEffect(next.fileId) {
        secs = 10
        while (secs > 0) { delay(1000); secs -= 1 }
        onPlayNext(next.fileId)
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(Alignment.BottomEnd).displayCutoutPadding().navigationBarsPadding()
                .padding(20.dp).width(360.dp).clip(RoundedCornerShape(20.dp))
                .background(Color(0xF714171A)).padding(18.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("UP NEXT", color = PlayerTheme.Teal, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("Your next episode is ready", color = PlayerTheme.TextMuted, fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp))
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(40.dp)) {
                    Icon(Icons.Filled.Close, "Cancel next episode", tint = PlayerTheme.TextDim)
                }
            }
            Text(
                if (next.name.isNotEmpty()) "${next.label} · ${next.name}" else next.label,
                color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 12.dp),
            )
            Box(
                Modifier.padding(top = 10.dp).fillMaxWidth().height(3.dp)
                    .clip(RoundedCornerShape(2.dp)).background(Color(0x2BFFFFFF)),
            ) {
                Box(
                    Modifier.fillMaxWidth(secs / 10f).height(3.dp)
                        .clip(RoundedCornerShape(2.dp)).background(PlayerTheme.Teal),
                )
            }
            Row(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text("Starting in ${secs}s", color = PlayerTheme.TextDim, fontSize = 12.sp,
                    modifier = Modifier.weight(1f))
                Button(
                    onClick = { onPlayNext(next.fileId) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PlayerTheme.Teal,
                        contentColor = Color(0xFF061715),
                    ),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Icon(Icons.Filled.SkipNext, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Play now", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
