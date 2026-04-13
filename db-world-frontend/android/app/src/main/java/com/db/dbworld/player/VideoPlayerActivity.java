package com.db.dbworld.player;

import android.annotation.SuppressLint;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;
import androidx.media3.ui.AspectRatioFrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.PlayerView;

import com.db.dbworld.R;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Full-featured ExoPlayer activity for DB-World.
 *
 * Features:
 * - Hardware-accelerated decoding (EAC3 / Dolby Digital Plus, H.264, H.265, AV1)
 * - 4K / HDR support (device-dependent hardware codec)
 * - HLS + DASH + progressive MP4/MKV
 * - Custom controls: play/pause, seekbar, time, audio & subtitle track picker
 * - Double-tap left/right to seek ±10 s
 * - Swipe left for brightness, right for volume
 * - Control auto-hide (3.5 s) and lock screen
 * - Picture-in-Picture (Android 8+)
 * - Resume position persisted via SharedPreferences
 */
@OptIn(markerClass = UnstableApi.class)
public class VideoPlayerActivity extends AppCompatActivity implements Player.Listener {

    // ── Intent extras ──────────────────────────────────────────────────────────
    public static final String EXTRA_URL             = "url";
    public static final String EXTRA_TITLE           = "title";
    public static final String EXTRA_FILE_NAME       = "fileName";
    public static final String EXTRA_FILE_ID         = "fileId";
    public static final String EXTRA_PREFERRED_AUDIO = "preferredAudio";
    public static final String EXTRA_PREFERRED_SUB   = "preferredSub";

    // ── Constants ──────────────────────────────────────────────────────────────
    private static final long   SEEK_MS              = 10_000L;
    private static final int    HIDE_DELAY_MS        = 3_500;
    private static final String PREFS_NAME           = "dbworld_player";
    private static final String PREFS_KEY_POS        = "pos_";

    // ── Player ─────────────────────────────────────────────────────────────────
    private ExoPlayer             player;
    private PlayerView            playerView;
    private DefaultTrackSelector  trackSelector;

    // ── Views ──────────────────────────────────────────────────────────────────
    private FrameLayout  controlsContainer;
    private FrameLayout  lockOverlay;
    private ImageButton  btnBack, btnPip, btnPlayPause;
    private ImageButton  btnAudioTrack, btnSubtitleTrack, btnLock, btnUnlock, btnAspect;
    private TextView     tvTitle, tvTime, btnSpeed;
    private TextView     tvSeekLeft, tvSeekRight;
    private SeekBar      seekBar;
    private ProgressBar  bufferingIndicator;
    private LinearLayout gestureIndicator;
    private ImageView    gestureIcon;
    private TextView     gestureValue;

    // ── Playback speed ─────────────────────────────────────────────────────────
    private static final float[] SPEEDS        = {0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f};
    private static final String[] SPEED_LABELS = {"0.5×", "0.75×", "1×", "1.25×", "1.5×", "2×"};
    private int currentSpeedIdx = 2; // 1.0×

    // ── Aspect ratio ───────────────────────────────────────────────────────────
    private static final int[] ASPECT_MODES  = {
        AspectRatioFrameLayout.RESIZE_MODE_FIT,
        AspectRatioFrameLayout.RESIZE_MODE_FILL,
        AspectRatioFrameLayout.RESIZE_MODE_ZOOM,
    };
    private static final String[] ASPECT_LABELS = {"Fit", "Fill", "Zoom"};
    private int currentAspectIdx = 0;

    // ── State ──────────────────────────────────────────────────────────────────
    private boolean controlsVisible    = true;
    private boolean isLocked           = false;
    private boolean isSeekBarTracking  = false;
    private boolean isInPiP            = false;

    // ── Persist ────────────────────────────────────────────────────────────────
    private SharedPreferences prefs;
    private String            fileId;

    // ── Gestures ───────────────────────────────────────────────────────────────
    private GestureDetector gestureDetector;
    private AudioManager    audioManager;
    private float           gestureStartY;
    private float           gestureStartVolume;
    private float           gestureStartBrightness;
    private boolean         gestureIsBrightness;
    private int             screenWidth;
    private int             screenHeight;

    // ── Tracks ─────────────────────────────────────────────────────────────────
    private final List<TrackGroup> audioGroups    = new ArrayList<>();
    private final List<TrackGroup> subtitleGroups = new ArrayList<>();
    private int currentAudioGroupIdx    = -1;
    private int currentSubtitleGroupIdx = -1; // -1 = off

    // ── Preferences ────────────────────────────────────────────────────────────
    private String preferredAudio = "";
    private String preferredSub   = "";

    // ── Handler / Runnables ────────────────────────────────────────────────────
    private final Handler  handler             = new Handler(Looper.getMainLooper());
    private final Runnable hideControlsRunnable = this::hideControls;
    private final Runnable updateTimeRunnable   = new Runnable() {
        @Override public void run() {
            updateTimeDisplay();
            handler.postDelayed(this, 500);
        }
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  Lifecycle
    // ══════════════════════════════════════════════════════════════════════════

    @Override
    @SuppressLint("ClickableViewAccessibility")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setImmersiveMode();

        setContentView(R.layout.activity_video_player);

        // Extras
        String url = getIntent().getStringExtra(EXTRA_URL);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        fileId = getIntent().getStringExtra(EXTRA_FILE_ID);
        preferredAudio = nvl(getIntent().getStringExtra(EXTRA_PREFERRED_AUDIO));
        preferredSub   = nvl(getIntent().getStringExtra(EXTRA_PREFERRED_SUB));

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        screenWidth  = getResources().getDisplayMetrics().widthPixels;
        screenHeight = getResources().getDisplayMetrics().heightPixels;

        bindViews();
        tvTitle.setText(title != null ? title : "");

        setupControls();
        setupGestures();

        if (url != null && !url.isEmpty()) {
            initializePlayer(url);
        } else {
            finish();
            return;
        }

        scheduleHideControls();
    }

    @Override
    protected void onResume() {
        super.onResume();
        setImmersiveMode();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (!isInPiP && player != null) {
            player.pause();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        savePosition();
        releasePlayer();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        if (isInPiP) {
            // Already in PiP – let the user close naturally
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && player != null && player.isPlaying()) {
            enterPiP();
        } else {
            finish();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Player initialisation
    // ══════════════════════════════════════════════════════════════════════════

    private void initializePlayer(String url) {
        // Prefer hardware decoders; fall back to software if needed
        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
                .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
                .setEnableDecoderFallback(true);

        // Track selector with language preference
        trackSelector = new DefaultTrackSelector(this);
        DefaultTrackSelector.Parameters.Builder params = trackSelector.getParameters().buildUpon();

        if (!preferredAudio.isEmpty()) {
            params.setPreferredAudioLanguage(toIsoCode(preferredAudio));
        }
        if (!preferredSub.isEmpty() && !preferredSub.equalsIgnoreCase("null")) {
            params.setPreferredTextLanguage(toIsoCode(preferredSub));
        } else {
            // Subtitles off by default
            params.setIgnoredTextSelectionFlags(
                    C.SELECTION_FLAG_DEFAULT | C.SELECTION_FLAG_AUTOSELECT);
        }
        trackSelector.setParameters(params.build());

        player = new ExoPlayer.Builder(this, renderersFactory)
                .setTrackSelector(trackSelector)
                .build();

        playerView.setPlayer(player);
        player.addListener(this);

        // Build MediaItem – detect HLS / DASH / progressive
        MediaItem mediaItem;
        if (url.contains(".m3u8")) {
            mediaItem = new MediaItem.Builder()
                    .setUri(url)
                    .setMimeType(MimeTypes.APPLICATION_M3U8)
                    .build();
        } else if (url.contains(".mpd")) {
            mediaItem = new MediaItem.Builder()
                    .setUri(url)
                    .setMimeType(MimeTypes.APPLICATION_MPD)
                    .build();
        } else {
            mediaItem = MediaItem.fromUri(url);
        }

        player.setMediaItem(mediaItem);
        player.prepare();

        // Restore saved position
        if (fileId != null && !fileId.isEmpty()) {
            long saved = prefs.getLong(PREFS_KEY_POS + fileId, 0);
            if (saved > 5_000) {
                player.seekTo(saved);
            }
        }

        player.setPlayWhenReady(true);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Player.Listener callbacks
    // ══════════════════════════════════════════════════════════════════════════

    @Override
    public void onPlaybackStateChanged(int state) {
        switch (state) {
            case Player.STATE_BUFFERING:
                bufferingIndicator.setVisibility(View.VISIBLE);
                break;
            case Player.STATE_READY:
                bufferingIndicator.setVisibility(View.GONE);
                refreshPlayPauseIcon();
                break;
            case Player.STATE_ENDED:
                bufferingIndicator.setVisibility(View.GONE);
                showControls();
                break;
            default:
                bufferingIndicator.setVisibility(View.GONE);
        }
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        refreshPlayPauseIcon();
        if (isPlaying) {
            scheduleHideControls();
        } else {
            handler.removeCallbacks(hideControlsRunnable);
            showControls();
        }
    }

    @Override
    public void onTracksChanged(@NonNull Tracks tracks) {
        audioGroups.clear();
        subtitleGroups.clear();
        currentAudioGroupIdx    = -1;
        currentSubtitleGroupIdx = -1;

        for (Tracks.Group group : tracks.getGroups()) {
            int type = group.getType();
            if (type == C.TRACK_TYPE_AUDIO) {
                if (group.isSelected()) currentAudioGroupIdx = audioGroups.size();
                audioGroups.add(group.getMediaTrackGroup());
            } else if (type == C.TRACK_TYPE_TEXT) {
                if (group.isSelected()) currentSubtitleGroupIdx = subtitleGroups.size();
                subtitleGroups.add(group.getMediaTrackGroup());
            }
        }
    }

    @Override
    public void onPlayerError(@NonNull PlaybackException error) {
        runOnUiThread(() ->
                new AlertDialog.Builder(this)
                        .setTitle("Playback Error")
                        .setMessage(error.getMessage())
                        .setPositiveButton("Close",  (d, w) -> finish())
                        .setNegativeButton("Retry",  (d, w) -> {
                            if (player != null) player.prepare();
                        })
                        .show()
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Controls setup
    // ══════════════════════════════════════════════════════════════════════════

    private void bindViews() {
        playerView         = findViewById(R.id.player_view);
        controlsContainer  = findViewById(R.id.controls_container);
        lockOverlay        = findViewById(R.id.lock_overlay);
        btnBack            = findViewById(R.id.btn_back);
        btnPip             = findViewById(R.id.btn_pip);
        btnPlayPause       = findViewById(R.id.btn_play_pause);
        btnAudioTrack      = findViewById(R.id.btn_audio_track);
        btnSubtitleTrack   = findViewById(R.id.btn_subtitle_track);
        btnSpeed           = findViewById(R.id.btn_speed);
        btnAspect          = findViewById(R.id.btn_aspect);
        btnLock            = findViewById(R.id.btn_lock);
        btnUnlock          = findViewById(R.id.btn_unlock);
        tvTitle            = findViewById(R.id.tv_title);
        tvTime             = findViewById(R.id.tv_time);
        tvSeekLeft         = findViewById(R.id.tv_seek_left);
        tvSeekRight        = findViewById(R.id.tv_seek_right);
        seekBar            = findViewById(R.id.seek_bar);
        bufferingIndicator = findViewById(R.id.buffering_indicator);
        gestureIndicator   = findViewById(R.id.gesture_indicator);
        gestureIcon        = findViewById(R.id.gesture_icon);
        gestureValue       = findViewById(R.id.gesture_value);
    }

    private void setupControls() {
        btnBack.setOnClickListener(v -> onBackPressed());

        btnPip.setOnClickListener(v -> enterPiP());

        btnPlayPause.setOnClickListener(v -> {
            if (player == null) return;
            if (player.isPlaying()) player.pause(); else player.play();
            scheduleHideControls();
        });

        btnAudioTrack.setOnClickListener(v -> {
            scheduleHideControls();
            showAudioTrackDialog();
        });

        btnSubtitleTrack.setOnClickListener(v -> {
            scheduleHideControls();
            showSubtitleTrackDialog();
        });

        // Playback speed — cycle through SPEEDS on click, long-press shows picker
        btnSpeed.setOnClickListener(v -> {
            currentSpeedIdx = (currentSpeedIdx + 1) % SPEEDS.length;
            applyPlaybackSpeed();
            scheduleHideControls();
        });
        btnSpeed.setOnLongClickListener(v -> {
            showSpeedDialog();
            return true;
        });

        // Aspect ratio — cycle through ASPECT_MODES
        btnAspect.setOnClickListener(v -> {
            currentAspectIdx = (currentAspectIdx + 1) % ASPECT_MODES.length;
            applyAspectRatio();
            scheduleHideControls();
        });

        btnLock.setOnClickListener(v -> {
            isLocked = true;
            handler.removeCallbacks(hideControlsRunnable);
            controlsContainer.setVisibility(View.GONE);
            lockOverlay.setVisibility(View.VISIBLE);
        });

        btnUnlock.setOnClickListener(v -> {
            isLocked = false;
            lockOverlay.setVisibility(View.GONE);
            showControls();
            scheduleHideControls();
        });

        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar sb, int progress, boolean fromUser) {
                if (!fromUser || player == null) return;
                long dur = player.getDuration();
                if (dur > 0) {
                    long pos = (long) (dur * progress / 100.0);
                    player.seekTo(pos);
                    tvTime.setText(String.format("%s / %s", fmtTime(pos), fmtTime(dur)));
                }
            }
            @Override public void onStartTrackingTouch(SeekBar sb) {
                isSeekBarTracking = true;
                handler.removeCallbacks(hideControlsRunnable);
            }
            @Override public void onStopTrackingTouch(SeekBar sb) {
                isSeekBarTracking = false;
                scheduleHideControls();
            }
        });

        handler.post(updateTimeRunnable);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Gesture setup
    // ══════════════════════════════════════════════════════════════════════════

    @SuppressLint("ClickableViewAccessibility")
    private void setupGestures() {
        gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onSingleTapConfirmed(MotionEvent e) {
                if (!isLocked) toggleControls();
                return true;
            }

            @Override
            public boolean onDoubleTap(MotionEvent e) {
                if (isLocked) return true;
                float x = e.getX();
                if (x < screenWidth / 3.0f) {
                    seekBy(-SEEK_MS);
                    flashSeek(false);
                } else if (x > screenWidth * 2.0f / 3.0f) {
                    seekBy(SEEK_MS);
                    flashSeek(true);
                } else {
                    if (player != null) {
                        if (player.isPlaying()) player.pause(); else player.play();
                    }
                }
                return true;
            }

            @Override public boolean onDown(MotionEvent e) { return true; }
        });
    }

    /**
     * All touch events flow through here so gestures are detected even when
     * controls_container is GONE.
     */
    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (!isLocked) {
            gestureDetector.onTouchEvent(event);
            handleSwipe(event);
        }
        return super.dispatchTouchEvent(event);
    }

    private void handleSwipe(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                gestureStartY = event.getY();
                gestureIsBrightness = event.getX() < screenWidth / 2.0f;
                if (gestureIsBrightness) {
                    WindowManager.LayoutParams lp = getWindow().getAttributes();
                    gestureStartBrightness = (lp.screenBrightness < 0) ? 0.5f : lp.screenBrightness;
                } else {
                    gestureStartVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                }
                break;

            case MotionEvent.ACTION_MOVE:
                float delta    = gestureStartY - event.getY();
                float fraction = delta / (screenHeight * 0.6f);

                if (gestureIsBrightness) {
                    float b = clamp(gestureStartBrightness + fraction, 0.01f, 1f);
                    WindowManager.LayoutParams lp = getWindow().getAttributes();
                    lp.screenBrightness = b;
                    getWindow().setAttributes(lp);
                    showGesture(true, (int) (b * 100));
                } else {
                    int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    int vol = clamp((int) (gestureStartVolume + fraction * max), 0, max);
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, vol, 0);
                    showGesture(false, max > 0 ? (int) (vol * 100f / max) : 0);
                }
                break;

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                handler.postDelayed(() -> gestureIndicator.setVisibility(View.GONE), 600);
                break;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Track selection dialogs
    // ══════════════════════════════════════════════════════════════════════════

    private void showAudioTrackDialog() {
        if (audioGroups.isEmpty()) return;

        String[] labels = new String[audioGroups.size()];
        for (int i = 0; i < audioGroups.size(); i++) {
            Format fmt = audioGroups.get(i).getFormat(0);
            String lang    = langName(fmt.language);
            String codec   = codecLabel(fmt.sampleMimeType);
            String layout  = fmt.channelCount > 0 ? fmt.channelCount + "ch" : "";
            String bitrate = fmt.bitrate > 0
                    ? Math.round(fmt.bitrate / 1000f) + " kbps"
                    : "";
            labels[i] = lang + "  [" + codec + (layout.isEmpty() ? "" : " · " + layout)
                    + (bitrate.isEmpty() ? "" : " · " + bitrate) + "]";
        }

        new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("Audio Track")
                .setSingleChoiceItems(labels, currentAudioGroupIdx, (d, which) -> {
                    currentAudioGroupIdx = which;
                    applyAudioTrack(which);
                    d.dismiss();
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void showSubtitleTrackDialog() {
        String[] labels = new String[subtitleGroups.size() + 1];
        labels[0] = "Off";
        for (int i = 0; i < subtitleGroups.size(); i++) {
            Format fmt = subtitleGroups.get(i).getFormat(0);
            labels[i + 1] = langName(fmt.language);
        }

        int sel = currentSubtitleGroupIdx >= 0 ? currentSubtitleGroupIdx + 1 : 0;

        new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("Subtitles")
                .setSingleChoiceItems(labels, sel, (d, which) -> {
                    if (which == 0) {
                        currentSubtitleGroupIdx = -1;
                        disableSubtitles();
                    } else {
                        currentSubtitleGroupIdx = which - 1;
                        applySubtitleTrack(which - 1);
                    }
                    d.dismiss();
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    private void applyAudioTrack(int groupIdx) {
        if (player == null || groupIdx >= audioGroups.size()) return;
        player.setTrackSelectionParameters(
                player.getTrackSelectionParameters().buildUpon()
                        .setOverrideForType(
                                new TrackSelectionOverride(audioGroups.get(groupIdx), 0))
                        .build());
    }

    private void applySubtitleTrack(int groupIdx) {
        if (player == null || groupIdx >= subtitleGroups.size()) return;
        player.setTrackSelectionParameters(
                player.getTrackSelectionParameters().buildUpon()
                        .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                        .setIgnoredTextSelectionFlags(0)
                        .setOverrideForType(
                                new TrackSelectionOverride(subtitleGroups.get(groupIdx), 0))
                        .build());
    }

    private void disableSubtitles() {
        if (player == null) return;
        DefaultTrackSelector.Parameters.Builder b = trackSelector.getParameters().buildUpon();
        // Override every subtitle group with empty selection
        for (TrackGroup g : subtitleGroups) {
            b.addOverride(new TrackSelectionOverride(g, Collections.emptyList()));
        }
        trackSelector.setParameters(b.build());
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Controls visibility
    // ══════════════════════════════════════════════════════════════════════════

    private void toggleControls() {
        if (controlsVisible) hideControls(); else { showControls(); scheduleHideControls(); }
    }

    private void showControls() {
        controlsVisible = true;
        controlsContainer.setVisibility(View.VISIBLE);
    }

    private void hideControls() {
        controlsVisible = false;
        controlsContainer.setVisibility(View.GONE);
    }

    private void scheduleHideControls() {
        handler.removeCallbacks(hideControlsRunnable);
        if (!isSeekBarTracking) {
            handler.postDelayed(hideControlsRunnable, HIDE_DELAY_MS);
        }
    }

    private void refreshPlayPauseIcon() {
        if (player == null) return;
        btnPlayPause.setImageResource(
                player.isPlaying()
                        ? android.R.drawable.ic_media_pause
                        : android.R.drawable.ic_media_play);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Time / seekbar update
    // ══════════════════════════════════════════════════════════════════════════

    private void updateTimeDisplay() {
        if (player == null || isSeekBarTracking) return;
        long pos = player.getCurrentPosition();
        long dur = Math.max(0, player.getDuration());
        tvTime.setText(String.format("%s / %s", fmtTime(pos), fmtTime(dur)));
        seekBar.setProgress(dur > 0 ? (int) (pos * 100 / dur) : 0);
        seekBar.setSecondaryProgress(dur > 0 ? (int) (player.getBufferedPosition() * 100 / dur) : 0);
    }

    private String fmtTime(long ms) {
        if (ms < 0) ms = 0;
        long s = ms / 1000, m = s / 60, h = m / 60;
        s %= 60; m %= 60;
        return h > 0
                ? String.format(Locale.US, "%d:%02d:%02d", h, m, s)
                : String.format(Locale.US, "%d:%02d", m, s);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Seek helpers
    // ══════════════════════════════════════════════════════════════════════════

    private void seekBy(long ms) {
        if (player == null) return;
        long dur = player.getDuration();
        long pos = clamp(player.getCurrentPosition() + ms, 0, dur > 0 ? dur : Long.MAX_VALUE);
        player.seekTo(pos);
        scheduleHideControls();
    }

    private void flashSeek(boolean forward) {
        TextView v = forward ? tvSeekRight : tvSeekLeft;
        v.setVisibility(View.VISIBLE);
        handler.postDelayed(() -> v.setVisibility(View.GONE), 700);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Gesture indicator (brightness / volume)
    // ══════════════════════════════════════════════════════════════════════════

    private void showGesture(boolean isBrightness, int pct) {
        gestureIndicator.setVisibility(View.VISIBLE);
        gestureIcon.setImageResource(
                isBrightness
                        ? android.R.drawable.ic_menu_day
                        : android.R.drawable.ic_lock_silent_mode_off);
        gestureValue.setText(pct + "%");
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Picture-in-Picture
    // ══════════════════════════════════════════════════════════════════════════

    private void enterPiP() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .build();
            enterPictureInPictureMode(params);
        }
    }

    @Override
    public void onPictureInPictureModeChanged(
            boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        isInPiP = isInPictureInPictureMode;
        if (isInPictureInPictureMode) {
            controlsContainer.setVisibility(View.GONE);
            lockOverlay.setVisibility(View.GONE);
        } else {
            showControls();
            scheduleHideControls();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Immersive / fullscreen
    // ══════════════════════════════════════════════════════════════════════════

    @SuppressWarnings("deprecation")
    private void setImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Player release & position save
    // ══════════════════════════════════════════════════════════════════════════

    private void savePosition() {
        if (player == null || fileId == null || fileId.isEmpty()) return;
        long pos = player.getCurrentPosition();
        long dur = player.getDuration();
        String key = PREFS_KEY_POS + fileId;
        if (pos > 5_000 && (dur <= 0 || pos < dur - 30_000)) {
            prefs.edit().putLong(key, pos).apply();
        } else if (dur > 0 && pos >= dur - 30_000) {
            prefs.edit().remove(key).apply(); // finished – clear resume
        }
    }

    private void releasePlayer() {
        handler.removeCallbacks(updateTimeRunnable);
        if (player != null) {
            player.removeListener(this);
            player.release();
            player = null;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Playback speed
    // ══════════════════════════════════════════════════════════════════════════

    private void applyPlaybackSpeed() {
        if (player == null) return;
        float speed = SPEEDS[currentSpeedIdx];
        player.setPlaybackSpeed(speed);
        btnSpeed.setText(SPEED_LABELS[currentSpeedIdx]);
    }

    private void showSpeedDialog() {
        int currentSel = currentSpeedIdx;
        new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("Playback Speed")
                .setSingleChoiceItems(SPEED_LABELS, currentSel, (d, which) -> {
                    currentSpeedIdx = which;
                    applyPlaybackSpeed();
                    d.dismiss();
                    scheduleHideControls();
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Aspect ratio
    // ══════════════════════════════════════════════════════════════════════════

    private void applyAspectRatio() {
        playerView.setResizeMode(ASPECT_MODES[currentAspectIdx]);
        // Brief toast-like feedback via the gesture indicator
        gestureIndicator.setVisibility(View.VISIBLE);
        gestureIcon.setImageResource(android.R.drawable.ic_menu_crop);
        gestureValue.setText(ASPECT_LABELS[currentAspectIdx]);
        handler.postDelayed(() -> gestureIndicator.setVisibility(View.GONE), 900);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Utility helpers
    // ══════════════════════════════════════════════════════════════════════════

    private static String nvl(String s) { return s != null ? s : ""; }

    private static float clamp(float v, float lo, float hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    private static int clamp(int v, int lo, int hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    private static long clamp(long v, long lo, long hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    /** Convert a display-name like "Hindi" to its ISO-639 code. */
    private static String toIsoCode(String name) {
        switch (name.toLowerCase(Locale.US)) {
            case "hindi":     return "hi";
            case "english":   return "en";
            case "tamil":     return "ta";
            case "telugu":    return "te";
            case "kannada":   return "kn";
            case "malayalam": return "ml";
            case "bengali":   return "bn";
            case "marathi":   return "mr";
            case "gujarati":  return "gu";
            case "punjabi":   return "pa";
            case "french":    return "fr";
            case "german":    return "de";
            case "spanish":   return "es";
            case "japanese":  return "ja";
            case "korean":    return "ko";
            case "chinese":   return "zh";
            default:
                return name.length() >= 2
                        ? name.substring(0, 2).toLowerCase(Locale.US)
                        : name;
        }
    }

    /** Return a human-readable language name from an ISO-639 code. */
    private static String langName(String iso) {
        if (iso == null || iso.isEmpty()) return "Unknown";
        try {
            String n = new Locale(iso).getDisplayLanguage(Locale.ENGLISH);
            return (n == null || n.isEmpty()) ? iso.toUpperCase(Locale.US) : n;
        } catch (Exception e) {
            return iso.toUpperCase(Locale.US);
        }
    }

    /** Strip the "audio/" prefix and upper-case the codec label. */
    private static String codecLabel(String mimeType) {
        if (mimeType == null) return "?";
        String s = mimeType.replace("audio/", "").replace("video/", "");
        // EAC-3 alias
        if (s.equalsIgnoreCase("eac3") || s.equalsIgnoreCase("ec-3")) return "EAC-3";
        if (s.equalsIgnoreCase("ac-3") || s.equalsIgnoreCase("ac3"))  return "AC-3";
        return s.toUpperCase(Locale.US);
    }
}
