package com.db.dbworld.player.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.db.dbworld.player.PlayerEpisode

/**
 * Episode picker matching the React player's episode rail: thumbnail + code tag + title +
 * 2-line overview, with a now-playing marker and an explicit close (X) button.
 */
@Composable
fun EpisodeSheet(
    state: PlayerUiState,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val visible = remember { MutableTransitionState(false).apply { targetState = true } }
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = onDismiss)) {
        AnimatedVisibility(
            visibleState = visible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
        ) {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 460.dp)
                    .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp))
                    .background(PlayerTheme.SheetBg)
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                    .padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            ) {
                Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Episodes", color = PlayerTheme.Text, fontSize = 16.sp,
                        fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, contentDescription = "Close", tint = PlayerTheme.TextDim)
                    }
                }
                val listState = rememberLazyListState()
                // Open scrolled to the episode that's currently playing.
                LaunchedEffect(Unit) {
                    val cur = state.episodes.indexOfFirst { it.fileId == state.currentFileId }
                    if (cur > 0) listState.scrollToItem(cur)
                }
                LazyColumn(state = listState, modifier = Modifier.fillMaxWidth().heightIn(max = 380.dp)) {
                    items(state.episodes) { ep ->
                        EpisodeRow(ep, selected = ep.fileId == state.currentFileId) { onSelect(ep.fileId) }
                    }
                }
            }
        }
    }
}

@Composable
private fun EpisodeRow(ep: PlayerEpisode, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 3.dp, horizontal = 8.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) PlayerTheme.Teal.copy(alpha = 0.14f) else Color.Transparent)
            .clickable(onClick = onClick).padding(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier.width(112.dp).height(63.dp).clip(RoundedCornerShape(8.dp)).background(Color(0x1FFFFFFF)),
            contentAlignment = Alignment.Center,
        ) {
            if (ep.still.isNotEmpty()) {
                AsyncImage(
                    model = ep.still, contentDescription = null,
                    contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
                )
            }
            if (selected) {
                Box(
                    Modifier.size(30.dp).clip(CircleShape).background(Color(0x99000000)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = PlayerTheme.Teal,
                        modifier = Modifier.size(22.dp))
                }
            }
            // Watched bar across the foot of the still, like the web list.
            if (ep.progress > 0f) {
                Box(
                    Modifier.align(Alignment.BottomStart).fillMaxWidth().height(3.dp)
                        .background(Color(0x47FFFFFF)),
                ) {
                    Box(
                        Modifier.fillMaxWidth(ep.progress.coerceIn(0f, 1f)).height(3.dp)
                            .background(PlayerTheme.Teal),
                    )
                }
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(ep.label, color = PlayerTheme.Teal, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                if (ep.runtime.isNotEmpty()) {
                    Text("  ·  ${ep.runtime}", color = PlayerTheme.TextMuted, fontSize = 12.sp)
                }
            }
            Text(
                ep.name.ifEmpty { ep.label },
                color = if (selected) PlayerTheme.Teal else PlayerTheme.Text,
                fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 1.dp),
            )
            if (ep.overview.isNotEmpty()) {
                Text(ep.overview, color = PlayerTheme.TextMuted, fontSize = 12.sp,
                    maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}
