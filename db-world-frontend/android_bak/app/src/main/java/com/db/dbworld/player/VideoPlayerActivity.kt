package com.db.dbworld.player

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.app.Activity
import android.content.pm.ActivityInfo
import android.media.AudioManager
import android.os.*
import android.provider.Settings
import android.util.TypedValue
import android.view.*
import android.view.animation.DecelerateInterpolator
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.*
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import kotlin.math.*

@UnstableApi
class VideoPlayerActivity : AppCompatActivity() {

    // ── Intent extras ──────────────────────────────────────────────────────────
    companion object {
        const val EXTRA_URL             = "url"
        const val EXTRA_TITLE           = "title"
        const val EXTRA_FILE_NAME       = "fileName"
        const val EXTRA_FILE_ID         = "fileId"
        const val EXTRA_PREFERRED_AUDIO = "preferredAudio"
        const val EXTRA_PREFERRED_SUB   = "preferredSub"

        private const val HIDE_DELAY_MS = 3500L
        private const val SEEK_STEP_MS  = 10_000L
        private const val PROGRESS_INTERVAL_MS = 500L
    }

    // ── Player ─────────────────────────────────────────────────────────────────
    private lateinit var player: ExoPlayer
    private lateinit var trackSelector: DefaultTrackSelector
    private lateinit var playerView: PlayerView

    // ── Intent data ────────────────────────────────────────────────────────────
    private var url            = ""
    private var title          = ""
    private var fileName       = ""
    private var fileId         = ""
    private var preferredAudio = "Hindi"
    private var preferredSub: String? = null

    // ── UI root ────────────────────────────────────────────────────────────────
    private lateinit var rootLayout: FrameLayout
    private lateinit var controlsRoot: FrameLayout

    // Top bar
    private lateinit var topBar: LinearLayout
    private lateinit var titleView: TextView
    private lateinit var rotationBtn: ImageButton
    private lateinit var infoBtn: ImageButton

    // Center
    private lateinit var centerRow: LinearLayout
    private lateinit var playPauseBtn: ImageButton
    private lateinit var loadingSpinner: ProgressBar

    // Bottom bar
    private lateinit var bottomBar: LinearLayout
    private lateinit var seekBar: SeekBar
    private lateinit var positionText: TextView
    private lateinit var durationText: TextView
    private lateinit var subtitleBtn: ImageButton
    private lateinit var audioBtn: ImageButton
    private lateinit var zoomBtn: ImageButton
    private lateinit var zoomLabel: TextView

    // Gesture feedback overlay
    private lateinit var gestureOverlay: LinearLayout
    private lateinit var gestureIcon: ImageView
    private lateinit var gestureBar: ProgressBar
    private lateinit var gestureLabel: TextView
    private lateinit var seekOverlay: TextView

    // ── State ─────────────────────────────────────────────────────────────────
    private var controlsVisible = true
    private val hideHandler   = Handler(Looper.getMainLooper())
    private val progressHandler = Handler(Looper.getMainLooper())
    private val hideRunnable  = Runnable { hideControls() }

    private var zoomMode = 0         // 0=FIT, 1=ZOOM, 2=FILL, 3=ORIGINAL
    private val zoomLabels  = listOf("Fit", "Zoom", "Fill", "Original")
    private val zoomModes   = listOf(
        AspectRatioFrameLayout.RESIZE_MODE_FIT,
        AspectRatioFrameLayout.RESIZE_MODE_ZOOM,
        AspectRatioFrameLayout.RESIZE_MODE_FILL,
        AspectRatioFrameLayout.RESIZE_MODE_FIXED_WIDTH,
    )

    private var isRotationLocked  = false
    private var isLandscape       = true

    // Gesture tracking
    private var gestureStartX    = 0f
    private var gestureStartY    = 0f
    private var gestureZone      = 0     // 0=none, 1=left(brightness), 2=right(volume), 3=center(seek)
    private var gestureConsumed  = false
    private var initialBrightness = -1f
    private var initialVolume     = 0

    // Double-tap
    private var lastTapTime = 0L
    private var lastTapX    = 0f

    private lateinit var audioManager: AudioManager
    private var maxVolume = 0

    // Progress loop
    private val progressRunnable = object : Runnable {
        override fun run() {
            updateProgress()
            progressHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fullscreen immersive
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val ctrl = WindowInsetsControllerCompat(window, window.decorView)
        ctrl.hide(WindowInsetsCompat.Type.systemBars())
        ctrl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Parse intent
        url             = intent.getStringExtra(EXTRA_URL)             ?: run { finish(); return }
        title           = intent.getStringExtra(EXTRA_TITLE)           ?: ""
        fileName        = intent.getStringExtra(EXTRA_FILE_NAME)       ?: ""
        fileId          = intent.getStringExtra(EXTRA_FILE_ID)         ?: url
        preferredAudio  = intent.getStringExtra(EXTRA_PREFERRED_AUDIO) ?: "Hindi"
        preferredSub    = intent.getStringExtra(EXTRA_PREFERRED_SUB)

        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        maxVolume    = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)

        // Restore prefs
        zoomMode          = PlayerPrefs.loadZoomMode(this)
        isRotationLocked  = PlayerPrefs.loadRotationLock(this)
        val savedBrightness = PlayerPrefs.loadBrightness(this)
        if (savedBrightness > 0f) {
            val lp = window.attributes
            lp.screenBrightness = savedBrightness
            window.attributes = lp
        }

        // Orientation
        applyOrientation()

        buildUI()
        setupPlayer()
        showControls()
    }

    override fun onStart() {
        super.onStart()
        if (::player.isInitialized) player.play()
        progressHandler.post(progressRunnable)
    }

    override fun onStop() {
        super.onStop()
        progressHandler.removeCallbacks(progressRunnable)
        if (::player.isInitialized) {
            PlayerPrefs.savePosition(this, fileId, player.currentPosition)
            player.pause()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        hideHandler.removeCallbacksAndMessages(null)
        progressHandler.removeCallbacksAndMessages(null)
        if (::player.isInitialized) player.release()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            val ctrl = WindowInsetsControllerCompat(window, window.decorView)
            ctrl.hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    // ── Player setup ──────────────────────────────────────────────────────────

    private fun setupPlayer() {
        trackSelector = DefaultTrackSelector(this).apply {
            setParameters(
                buildUponParameters()
                    .setPreferredAudioLanguage(resolveAudioLang(preferredAudio))
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, preferredSub == null)
                    .apply {
                        if (preferredSub != null) setPreferredTextLanguage(preferredSub)
                    }
                    .build()
            )
        }

        player = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector)
            .build()
            .also { exo ->
                playerView.player = exo
                playerView.setResizeMode(zoomModes[zoomMode])
                playerView.useController = false  // using our own controls

                val mediaItem = MediaItem.fromUri(url)
                exo.setMediaItem(mediaItem)

                val resumePos = PlayerPrefs.loadPosition(this, fileId)
                if (resumePos > 0L) {
                    exo.seekTo(resumePos)
                    showResumeToast(resumePos)
                }

                exo.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        val isLoading = state == Player.STATE_BUFFERING
                        loadingSpinner.visibility = if (isLoading) View.VISIBLE else View.GONE
                        if (state == Player.STATE_READY) {
                            updatePlayPauseIcon()
                            applyPreferredTracks()
                        }
                        if (state == Player.STATE_ENDED) {
                            PlayerPrefs.clearPosition(this@VideoPlayerActivity, fileId)
                            showControls()
                        }
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        updatePlayPauseIcon()
                        if (isPlaying) resetHideTimer() else {
                            hideHandler.removeCallbacks(hideRunnable)
                            showControls()
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        showError(error.message ?: "Playback error")
                    }
                })

                exo.prepare()
                exo.play()
            }
    }

    /** Map human-readable audio name → ISO 639-2 code used in ExoPlayer. */
    private fun resolveAudioLang(name: String): String {
        return when {
            name.contains("Hindi", ignoreCase = true)     -> "hin"
            name.contains("English", ignoreCase = true)   -> "eng"
            name.contains("Tamil", ignoreCase = true)     -> "tam"
            name.contains("Telugu", ignoreCase = true)    -> "tel"
            name.contains("Malayalam", ignoreCase = true) -> "mal"
            name.contains("Kannada", ignoreCase = true)   -> "kan"
            name.contains("Bengali", ignoreCase = true)   -> "ben"
            name.contains("Japanese", ignoreCase = true)  -> "jpn"
            name.contains("Korean", ignoreCase = true)    -> "kor"
            name.contains("French", ignoreCase = true)    -> "fra"
            name.contains("German", ignoreCase = true)    -> "deu"
            name.contains("Spanish", ignoreCase = true)   -> "spa"
            name.length == 3                               -> name.lowercase()
            else                                           -> "hin"
        }
    }

    /** Called once player reaches STATE_READY — apply preferred audio/sub after tracks are known. */
    private fun applyPreferredTracks() {
        val tracks = player.currentTracks

        // Try to find Hindi audio track explicitly
        var hindiGroupIndex = -1
        var hindiTrackIndex = -1
        for ((gi, group) in tracks.groups.withIndex()) {
            if (group.type != C.TRACK_TYPE_AUDIO) continue
            for (ti in 0 until group.mediaTrackGroup.length) {
                val fmt = group.mediaTrackGroup.getFormat(ti)
                val lang = (fmt.language ?: "").lowercase()
                val label = (fmt.label ?: "").lowercase()
                if (lang.contains("hin") || label.contains("hindi")) {
                    hindiGroupIndex = gi; hindiTrackIndex = ti; break
                }
            }
            if (hindiGroupIndex >= 0) break
        }

        if (hindiGroupIndex >= 0) {
            val mediaGroup = tracks.groups[hindiGroupIndex].mediaTrackGroup
            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .setOverrideForType(
                        TrackSelectionOverride(mediaGroup, hindiTrackIndex)
                    )
                    .build()
            )
        }
    }

    // ── UI building ───────────────────────────────────────────────────────────

    private fun buildUI() {
        // Root
        rootLayout = FrameLayout(this).apply {
            setBackgroundColor(0xFF000000.toInt())
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        setContentView(rootLayout)

        // PlayerView
        playerView = PlayerView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setShutterBackgroundColor(0xFF000000.toInt())
            setBackgroundColor(0xFF000000.toInt())
        }
        rootLayout.addView(playerView)

        // Controls root (overlaid on top of player)
        controlsRoot = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(controlsRoot)

        // Gesture/tap layer (transparent, on top of playerView but below controls)
        val tapLayer = View(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setOnTouchListener(buildGestureListener())
        }
        controlsRoot.addView(tapLayer)

        // Gesture overlay (brightness / volume bar)
        buildGestureOverlay()

        // Seek overlay
        seekOverlay = TextView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            ).also { lp -> lp.setMargins(0, 0, 0, dp(80)) }
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 20f
            setPadding(dp(16), dp(8), dp(16), dp(8))
            setBackgroundColor(0xCC000000.toInt())
            visibility = View.GONE
        }
        controlsRoot.addView(seekOverlay)

        // Top bar
        buildTopBar()

        // Center controls
        buildCenterControls()

        // Bottom bar
        buildBottomBar()

        // Loading spinner
        loadingSpinner = ProgressBar(this).apply {
            layoutParams = FrameLayout.LayoutParams(dp(52), dp(52), Gravity.CENTER)
            isIndeterminate = true
            indeterminateTintList = ContextCompat.getColorStateList(this@VideoPlayerActivity,
                android.R.color.white)
            visibility = View.GONE
        }
        controlsRoot.addView(loadingSpinner)

        updateZoomButton()
        updateRotationButton()
    }

    private fun buildTopBar() {
        val topGradient = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(0xCC000000.toInt(), 0x00000000)
        )
        topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(72),
                Gravity.TOP
            )
            background = topGradient
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), dp(8), dp(4), dp(8))
        }
        controlsRoot.addView(topBar)

        // Back button
        topBar.addView(makeIconButton(android.R.drawable.ic_menu_close_clear_cancel) {
            finish()
        }.apply { setPadding(dp(4), dp(4), dp(4), dp(4)) })

        // Title + filename
        val titleBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setPadding(dp(8), 0, dp(8), 0)
        }
        titleView = TextView(this).apply {
            text = if (title.isNotEmpty()) title else fileName
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 15f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        titleBox.addView(titleView)
        if (fileName.isNotEmpty() && title.isNotEmpty()) {
            titleBox.addView(TextView(this).apply {
                text = fileName
                setTextColor(0x99FFFFFF.toInt())
                textSize = 11f
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
        }
        topBar.addView(titleBox)

        // Info button
        infoBtn = makeIconButton(android.R.drawable.ic_dialog_info) { showMediaInfo() }
        topBar.addView(infoBtn)

        // Rotation lock button
        rotationBtn = makeIconButton(android.R.drawable.ic_menu_rotate) { toggleRotationLock() }
        topBar.addView(rotationBtn)
    }

    private fun buildCenterControls() {
        centerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
            gravity = Gravity.CENTER
        }
        controlsRoot.addView(centerRow)

        // Seek -10
        centerRow.addView(makeIconButton(android.R.drawable.ic_media_rew) {
            seekBy(-SEEK_STEP_MS)
        }.apply {
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).also {
                it.setMargins(dp(24), 0, dp(24), 0)
            }
        })

        // Play/Pause (large)
        playPauseBtn = makeIconButton(android.R.drawable.ic_media_play) {
            togglePlayPause()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(dp(72), dp(72))
        }
        centerRow.addView(playPauseBtn)

        // Seek +10
        centerRow.addView(makeIconButton(android.R.drawable.ic_media_ff) {
            seekBy(SEEK_STEP_MS)
        }.apply {
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).also {
                it.setMargins(dp(24), 0, dp(24), 0)
            }
        })
    }

    private fun buildBottomBar() {
        val bottomGradient = GradientDrawable(
            GradientDrawable.Orientation.BOTTOM_TOP,
            intArrayOf(0xCC000000.toInt(), 0x00000000)
        )
        bottomBar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            )
            background = bottomGradient
            setPadding(dp(4), dp(24), dp(4), dp(8))
        }
        controlsRoot.addView(bottomBar)

        // Seek bar row
        val seekRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8), 0, dp(8), 0)
        }
        bottomBar.addView(seekRow)

        positionText = TextView(this).apply {
            text = "0:00"
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 12f
            minWidth = dp(44)
        }
        seekRow.addView(positionText)

        seekBar = SeekBar(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).also {
                it.setMargins(dp(8), 0, dp(8), 0)
            }
            progressTintList = ContextCompat.getColorStateList(this@VideoPlayerActivity, android.R.color.white)
            thumb = null
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        val target = (progress / 1000f * player.duration).toLong()
                        positionText.text = formatTime(target)
                    }
                }
                override fun onStartTrackingTouch(sb: SeekBar) {
                    hideHandler.removeCallbacks(hideRunnable)
                }
                override fun onStopTrackingTouch(sb: SeekBar) {
                    val target = (sb.progress / 1000f * player.duration).toLong()
                    player.seekTo(target)
                    resetHideTimer()
                }
            })
        }
        seekRow.addView(seekBar)

        durationText = TextView(this).apply {
            text = "0:00"
            setTextColor(0x99FFFFFF.toInt())
            textSize = 12f
            minWidth = dp(44)
            gravity = Gravity.END
        }
        seekRow.addView(durationText)

        // Controls row
        val ctrlRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), 0, dp(4), 0)
        }
        bottomBar.addView(ctrlRow)

        // Subtitle button
        subtitleBtn = makeIconButton(android.R.drawable.ic_menu_share) { showSubtitleMenu() }
        ctrlRow.addView(subtitleBtn)

        // Audio button
        audioBtn = makeIconButton(android.R.drawable.ic_btn_speak_now) { showAudioMenu() }
        ctrlRow.addView(audioBtn)

        // Spacer
        ctrlRow.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
        })

        // Zoom button with label
        val zoomBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setOnClickListener { cycleZoom() }
            setPadding(dp(8), dp(4), dp(8), dp(4))
        }
        zoomBtn = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_zoom)
            setBackgroundColor(0)
            setColorFilter(0xFFFFFFFF.toInt())
            layoutParams = LinearLayout.LayoutParams(dp(32), dp(32))
        }
        zoomBox.addView(zoomBtn)
        zoomLabel = TextView(this).apply {
            textSize = 9f
            setTextColor(0x99FFFFFF.toInt())
            gravity = Gravity.CENTER
        }
        zoomBox.addView(zoomLabel)
        ctrlRow.addView(zoomBox)
    }

    private fun buildGestureOverlay() {
        gestureOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(dp(80), dp(160), Gravity.CENTER).also {
                it.setMargins(0, 0, 0, dp(40))
            }
            setBackgroundColor(0xBB000000.toInt())
            (background as? android.graphics.drawable.ColorDrawable)?.also { }
            background = GradientDrawable().apply {
                setColor(0xBB000000.toInt())
                cornerRadius = dp(12).toFloat()
            }
            setPadding(dp(12), dp(16), dp(12), dp(16))
            visibility = View.GONE
            elevation = dp(8).toFloat()
        }
        controlsRoot.addView(gestureOverlay)

        gestureIcon = ImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(28), dp(28)).also {
                it.setMargins(0, 0, 0, dp(8))
                it.gravity = Gravity.CENTER_HORIZONTAL
            }
            setColorFilter(0xFFFFFFFF.toInt())
        }
        gestureOverlay.addView(gestureIcon)

        gestureBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = LinearLayout.LayoutParams(dp(56), dp(6)).also {
                it.setMargins(0, 0, 0, dp(6))
                it.gravity = Gravity.CENTER_HORIZONTAL
            }
            max = 100
            progressTintList = ContextCompat.getColorStateList(this@VideoPlayerActivity, android.R.color.white)
        }
        gestureOverlay.addView(gestureBar)

        gestureLabel = TextView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.gravity = Gravity.CENTER_HORIZONTAL }
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 13f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        gestureOverlay.addView(gestureLabel)
    }

    // ── Gesture handling ──────────────────────────────────────────────────────

    private fun buildGestureListener(): View.OnTouchListener {
        return View.OnTouchListener { view, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    gestureStartX = event.x
                    gestureStartY = event.y
                    gestureZone   = 0
                    gestureConsumed = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.x - gestureStartX
                    val dy = event.y - gestureStartY

                    // Determine gesture type on first significant move
                    if (gestureZone == 0 && (abs(dx) > dp(10) || abs(dy) > dp(10))) {
                        val screenW = view.width.toFloat()
                        val relX = gestureStartX / screenW
                        gestureZone = when {
                            abs(dy) >= abs(dx) && relX < 0.35f -> 1  // brightness
                            abs(dy) >= abs(dx) && relX > 0.65f -> 2  // volume
                            abs(dx) > abs(dy)                   -> 3  // seek
                            else                                -> 0
                        }
                        if (gestureZone == 1) {
                            val lp = window.attributes
                            initialBrightness = if (lp.screenBrightness < 0f)
                                Settings.System.getInt(contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128) / 255f
                            else lp.screenBrightness
                        }
                        if (gestureZone == 2) {
                            initialVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
                        }
                    }

                    when (gestureZone) {
                        1 -> { // Brightness
                            val delta = -(event.y - gestureStartY) / view.height
                            val newBrightness = (initialBrightness + delta * 1.5f).coerceIn(0.01f, 1f)
                            val lp = window.attributes
                            lp.screenBrightness = newBrightness
                            window.attributes = lp
                            PlayerPrefs.saveBrightness(this, newBrightness)
                            showGestureOverlay(
                                icon = android.R.drawable.ic_menu_day,
                                value = (newBrightness * 100).toInt(),
                                label = "${(newBrightness * 100).toInt()}%"
                            )
                            gestureConsumed = true
                        }
                        2 -> { // Volume
                            val delta = -(event.y - gestureStartY) / view.height
                            val newVol = (initialVolume + (delta * maxVolume * 1.5f)).toInt().coerceIn(0, maxVolume)
                            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, newVol, 0)
                            showGestureOverlay(
                                icon = android.R.drawable.ic_lock_silent_mode_off,
                                value = (newVol * 100f / maxVolume).toInt(),
                                label = "${(newVol * 100f / maxVolume).toInt()}%"
                            )
                            gestureConsumed = true
                        }
                        3 -> { // Seek preview
                            val deltaMs = (dx / view.width * 120_000).toLong() // ±60s across full width
                            val target  = (player.currentPosition + deltaMs).coerceIn(0L, player.duration.coerceAtLeast(1L))
                            val dir     = if (deltaMs >= 0) "▶▶" else "◀◀"
                            seekOverlay.text = "$dir ${formatTime(target)}"
                            seekOverlay.visibility = View.VISIBLE
                            gestureConsumed = true
                        }
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (gestureZone == 3 && gestureConsumed) {
                        val dx = event.x - gestureStartX
                        val deltaMs = (dx / view.width * 120_000).toLong()
                        val target  = (player.currentPosition + deltaMs).coerceIn(0L, player.duration.coerceAtLeast(1L))
                        player.seekTo(target)
                    }
                    if (!gestureConsumed) {
                        handleTap(event.x, event.y, view.width.toFloat())
                    }
                    hideGestureOverlay()
                    seekOverlay.visibility = View.GONE
                    gestureZone = 0
                    gestureConsumed = false
                    true
                }
                else -> false
            }
        }
    }

    private fun handleTap(x: Float, y: Float, screenW: Float) {
        val now = SystemClock.uptimeMillis()
        val isDoubleTap = (now - lastTapTime) < 280 && abs(x - lastTapX) < dp(80)
        if (isDoubleTap) {
            lastTapTime = 0L
            if (x < screenW / 2) seekBy(-SEEK_STEP_MS)
            else seekBy(SEEK_STEP_MS)
        } else {
            lastTapTime = now
            lastTapX = x
            if (controlsVisible) hideControls() else showControls()
        }
    }

    // ── Controls visibility ───────────────────────────────────────────────────

    private fun showControls() {
        controlsVisible = true
        topBar.animate().alpha(1f).setDuration(200).start()
        centerRow.animate().alpha(1f).setDuration(200).start()
        bottomBar.animate().alpha(1f).setDuration(200).start()
        topBar.isClickable = true
        bottomBar.isClickable = true
        resetHideTimer()
    }

    private fun hideControls() {
        if (!player.isPlaying) return
        controlsVisible = false
        topBar.animate().alpha(0f).setDuration(300)
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    topBar.isClickable = false
                }
            }).start()
        centerRow.animate().alpha(0f).setDuration(300).start()
        bottomBar.animate().alpha(0f).setDuration(300)
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    bottomBar.isClickable = false
                }
            }).start()
    }

    private fun resetHideTimer() {
        hideHandler.removeCallbacks(hideRunnable)
        if (player.isPlaying) {
            hideHandler.postDelayed(hideRunnable, HIDE_DELAY_MS)
        }
    }

    // ── Playback controls ─────────────────────────────────────────────────────

    private fun togglePlayPause() {
        if (player.isPlaying) player.pause() else player.play()
        resetHideTimer()
    }

    private fun seekBy(ms: Long) {
        val target = (player.currentPosition + ms).coerceIn(0L, player.duration.coerceAtLeast(1L))
        player.seekTo(target)
        showSeekRippleText(ms)
        resetHideTimer()
    }

    private fun updatePlayPauseIcon() {
        val icon = if (player.isPlaying) android.R.drawable.ic_media_pause
                   else android.R.drawable.ic_media_play
        playPauseBtn.setImageResource(icon)
    }

    private fun updateProgress() {
        if (!::player.isInitialized) return
        val pos = player.currentPosition
        val dur = player.duration.takeIf { it > 0 } ?: return
        positionText.text = formatTime(pos)
        durationText.text = formatTime(dur)
        val progress = ((pos.toFloat() / dur) * 1000).toInt()
        val buffered = ((player.bufferedPosition.toFloat() / dur) * 1000).toInt()
        if (!isSeekBarTracking) {
            seekBar.max = 1000
            seekBar.progress = progress
            seekBar.secondaryProgress = buffered
        }
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────

    private fun cycleZoom() {
        zoomMode = (zoomMode + 1) % zoomModes.size
        playerView.setResizeMode(zoomModes[zoomMode])
        PlayerPrefs.saveZoomMode(this, zoomMode)
        updateZoomButton()
        showToast(zoomLabels[zoomMode])
        resetHideTimer()
    }

    private fun updateZoomButton() {
        zoomLabel.text = zoomLabels[zoomMode]
    }

    // ── Rotation ─────────────────────────────────────────────────────────────

    private fun toggleRotationLock() {
        isRotationLocked = !isRotationLocked
        PlayerPrefs.saveRotationLock(this, isRotationLocked)
        applyOrientation()
        updateRotationButton()
        showToast(if (isRotationLocked) "Rotation locked" else "Rotation unlocked")
        resetHideTimer()
    }

    private fun applyOrientation() {
        requestedOrientation = if (isRotationLocked) {
            if (resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE)
                ActivityInfo.SCREEN_ORIENTATION_LOCKED
            else ActivityInfo.SCREEN_ORIENTATION_LOCKED
        } else {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR
        }
    }

    private fun updateRotationButton() {
        rotationBtn.setColorFilter(
            if (isRotationLocked) 0xFFE59014.toInt() else 0xFFFFFFFF.toInt()
        )
    }

    // ── Track selection ───────────────────────────────────────────────────────

    private fun showAudioMenu() {
        resetHideTimer()
        val tracks = player.currentTracks
        val audioGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }
        if (audioGroups.isEmpty()) { showToast("No audio tracks detected"); return }

        val labels = mutableListOf<String>()
        val groupMap = mutableListOf<Pair<Int, Int>>() // (groupIndex, trackIndex)

        val allGroups = tracks.groups
        for ((gi, group) in allGroups.withIndex()) {
            if (group.type != C.TRACK_TYPE_AUDIO) continue
            for (ti in 0 until group.mediaTrackGroup.length) {
                val fmt = group.mediaTrackGroup.getFormat(ti)
                val lang    = fmt.language ?: ""
                val label   = fmt.label ?: ""
                val ch      = if (fmt.channelCount > 0) "${fmt.channelCount}ch" else ""
                val codec   = fmt.sampleMimeType?.substringAfterLast('/') ?: ""
                val display = buildString {
                    if (label.isNotEmpty()) append(label) else append(lang.ifEmpty { "Track ${labels.size + 1}" })
                    if (ch.isNotEmpty()) append("  $ch")
                    if (codec.isNotEmpty()) append("  [$codec]")
                }
                labels.add(display)
                groupMap.add(Pair(gi, ti))
            }
        }

        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_MinWidth)
            .setTitle("Audio Track")
            .setItems(labels.toTypedArray()) { _, which ->
                val (gi, ti) = groupMap[which]
                val mediaGroup = allGroups[gi].mediaTrackGroup
                trackSelector.setParameters(
                    trackSelector.buildUponParameters()
                        .setOverrideForType(TrackSelectionOverride(mediaGroup, ti))
                        .build()
                )
                resetHideTimer()
            }
            .show()
            .apply { window?.setBackgroundDrawableResource(android.R.color.background_dark) }
    }

    private fun showSubtitleMenu() {
        resetHideTimer()
        val tracks = player.currentTracks
        val allGroups = tracks.groups
        val labels = mutableListOf("Off")
        val groupMap = mutableListOf<Pair<Int, Int>>() // empty for index 0 (Off)
        groupMap.add(Pair(-1, -1))

        for ((gi, group) in allGroups.withIndex()) {
            if (group.type != C.TRACK_TYPE_TEXT) continue
            for (ti in 0 until group.mediaTrackGroup.length) {
                val fmt = group.mediaTrackGroup.getFormat(ti)
                val lang  = fmt.language ?: ""
                val label = fmt.label ?: ""
                val display = label.ifEmpty { lang.ifEmpty { "Subtitle ${labels.size}" } }
                labels.add(display)
                groupMap.add(Pair(gi, ti))
            }
        }

        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_MinWidth)
            .setTitle("Subtitles")
            .setItems(labels.toTypedArray()) { _, which ->
                if (which == 0) {
                    // Off
                    player.trackSelectionParameters = player.trackSelectionParameters
                        .buildUpon()
                        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                        .build()
                } else {
                    val (gi, ti) = groupMap[which]
                    val mediaGroup = allGroups[gi].mediaTrackGroup
                    player.trackSelectionParameters = player.trackSelectionParameters
                        .buildUpon()
                        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                        .setOverrideForType(TrackSelectionOverride(mediaGroup, ti))
                        .build()
                }
                resetHideTimer()
            }
            .show()
            .apply { window?.setBackgroundDrawableResource(android.R.color.background_dark) }
    }

    // ── Media info ────────────────────────────────────────────────────────────

    private fun showMediaInfo() {
        resetHideTimer()
        val tracks = player.currentTracks
        val sb = StringBuilder()

        sb.appendLine("▶  $title")
        if (fileName.isNotEmpty()) sb.appendLine("📄  $fileName")
        sb.appendLine()

        val dur = player.duration
        if (dur > 0) sb.appendLine("⏱  Duration: ${formatTime(dur)}")

        var hasVideo = false
        for (group in tracks.groups) {
            for (ti in 0 until group.mediaTrackGroup.length) {
                val fmt = group.mediaTrackGroup.getFormat(ti)
                when (group.type) {
                    C.TRACK_TYPE_VIDEO -> {
                        if (!hasVideo) { sb.appendLine(); sb.appendLine("🎬  Video") }
                        hasVideo = true
                        val res    = "${fmt.width}×${fmt.height}"
                        val fps    = if (fmt.frameRate > 0) "${fmt.frameRate.toInt()} fps" else ""
                        val codec  = fmt.sampleMimeType?.substringAfterLast('/') ?: ""
                        val bitrate = if (fmt.bitrate > 0) "${fmt.bitrate / 1000} kbps" else ""
                        sb.appendLine("   $res  $fps  $codec  $bitrate")
                    }
                    C.TRACK_TYPE_AUDIO -> {
                        sb.appendLine()
                        sb.appendLine("🔊  Audio")
                        val lang = fmt.language ?: ""
                        val ch   = if (fmt.channelCount > 0) "${fmt.channelCount}ch" else ""
                        val codec = fmt.sampleMimeType?.substringAfterLast('/') ?: ""
                        val sr   = if (fmt.sampleRate > 0) "${fmt.sampleRate / 1000}kHz" else ""
                        sb.appendLine("   ${lang.ifEmpty { "unknown" }}  $ch  $codec  $sr")
                    }
                    C.TRACK_TYPE_TEXT -> {
                        sb.appendLine("💬  Subtitle: ${fmt.language ?: fmt.label ?: "unknown"}")
                    }
                    else -> {}
                }
            }
        }

        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog)
            .setTitle("Media Info")
            .setMessage(sb.toString().trim())
            .setPositiveButton("OK") { d, _ -> d.dismiss(); resetHideTimer() }
            .show()
            .apply { window?.setBackgroundDrawableResource(android.R.color.background_dark) }
    }

    // ── Gesture overlay ───────────────────────────────────────────────────────

    private fun showGestureOverlay(icon: Int, value: Int, label: String) {
        gestureIcon.setImageResource(icon)
        gestureBar.progress = value.coerceIn(0, 100)
        gestureLabel.text = label
        gestureOverlay.visibility = View.VISIBLE
    }

    private fun hideGestureOverlay() {
        gestureOverlay.animate().alpha(0f).setDuration(300)
            .setListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    gestureOverlay.visibility = View.GONE
                    gestureOverlay.alpha = 1f
                }
            }).start()
    }

    private fun showSeekRippleText(ms: Long) {
        val sign = if (ms > 0) "+" else ""
        seekOverlay.text = "$sign${ms / 1000}s  ${formatTime((player.currentPosition + ms).coerceAtLeast(0L))}"
        seekOverlay.visibility = View.VISIBLE
        seekOverlay.animate().cancel()
        seekOverlay.alpha = 1f
        Handler(Looper.getMainLooper()).postDelayed({
            seekOverlay.animate().alpha(0f).setDuration(400)
                .setListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        seekOverlay.visibility = View.GONE
                        seekOverlay.alpha = 1f
                    }
                }).start()
        }, 800)
    }

    // ── Resume toast ──────────────────────────────────────────────────────────

    private fun showResumeToast(posMs: Long) {
        val toastView = TextView(this).apply {
            text = "Resume from ${formatTime(posMs)}"
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 14f
            setPadding(dp(20), dp(10), dp(20), dp(10))
            background = GradientDrawable().apply {
                setColor(0xCC000000.toInt())
                cornerRadius = dp(8).toFloat()
            }
        }
        val container = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL
            ).also { it.setMargins(0, dp(80), 0, 0) }
            addView(toastView)
        }
        rootLayout.addView(container)
        Handler(Looper.getMainLooper()).postDelayed({
            container.animate().alpha(0f).setDuration(500)
                .setListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        rootLayout.removeView(container)
                    }
                }).start()
        }, 3000)
    }

    private fun showError(msg: String) {
        AlertDialog.Builder(this)
            .setTitle("Playback Error")
            .setMessage(msg)
            .setPositiveButton("Close") { _, _ -> finish() }
            .setCancelable(false)
            .show()
    }

    private fun showToast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    private fun makeIconButton(resId: Int, onClick: () -> Unit): ImageButton =
        ImageButton(this).apply {
            setImageResource(resId)
            setBackgroundColor(0)
            setColorFilter(0xFFFFFFFF.toInt())
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)).also {
                it.setMargins(dp(2), 0, dp(2), 0)
            }
            setOnClickListener { onClick() }
        }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

    private fun formatTime(ms: Long): String {
        if (ms <= 0) return "0:00"
        val totalSecs = ms / 1000
        val h = totalSecs / 3600
        val m = (totalSecs % 3600) / 60
        val s = totalSecs % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, s)
        else "%d:%02d".format(m, s)
    }
}
