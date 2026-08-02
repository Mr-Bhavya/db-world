package com.db.dbworld.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Full-screen retry-able error, shown when [PlayerUiState.errorMessage] is non-null. */
@Composable
fun ErrorOverlay(state: PlayerUiState, onRetry: () -> Unit, onClose: () -> Unit) {
    val msg = state.errorMessage ?: return
    Box(Modifier.fillMaxSize().background(Color(0xEE000000))) {
        Column(
            Modifier.align(Alignment.Center).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Couldn't play this video", color = Color.White, fontSize = 18.sp)
            Text(msg, color = Color(0xFF9AA0A6), fontSize = 13.sp, textAlign = TextAlign.Center)
            Button(onClick = onRetry) { Text("Retry") }
            TextButton(onClick = onClose) { Text("Close", color = Color.White) }
        }
    }
}
