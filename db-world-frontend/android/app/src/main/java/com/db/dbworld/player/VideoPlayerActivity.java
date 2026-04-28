package com.db.dbworld.player;

import android.annotation.SuppressLint;
import android.app.Dialog;
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
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.animation.AnimationUtils;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
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
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import com.db.dbworld.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Full-featured ExoPlayer activity for DB-World.
 *
 * Features:
 * - Hardware-accelerated decoding (EAC-3/Dolby, H.264, H.265, AV1, 4K/HDR)
 * - HLS + DASH + progressive MP4/MKV
 * - Swipe left/right for brightness/volume with vertical bar indicators
 * - Pinch-to-zoom (cycles Fit ↔ Zoom)
 * - Combined Audio & Subtitles bottom-sheet
 * - Episode side-panel (same-quality episodes pre-filtered by JS caller)
 * - Speed picker popup
 * - Double-tap left/right to seek ±10 s
 * - Resume position, selected audio/subtitle persisted via SharedPreferences
 * - Progress emitted to JS on stop → saved to server
 * - Control auto-hide (3.5 s) and lock screen
 * - Picture-in-Picture (Android 8+)
 */
@OptIn(markerClass = UnstableApi.class)
public class VideoPlayerActivity extends AppCompatActivity implements Player.Listener {

    // ── Intent extras ──────────────────────────────────────────────────────────
    public static final String EXTRA_URL              = "url";
    public static final String EXTRA_TITLE            = "title";
    public static final String EXTRA_FILE_NAME        = "fileName";
    public static final String EXTRA_FILE_ID          = "fileId";
    public static final String EXTRA_PREFERRED_AUDIO  = "preferredAudio";
    public static final String EXTRA_PREFERRED_SUB    = "preferredSub";
    public static final String EXTRA_EPISODES_JSON    = "episodesJson";

    // ── Constants ──────────────────────────────────────────────────────────────
    private static final long   SEEK_MS       = 10_000L;
    private static final int    HIDE_DELAY_MS = 3_500;
    private static final String PREFS_NAME    = "dbworld_player";
    private static final String KEY_POS       = "pos_";
    private static final String KEY_AUDIO     = "audio_";
    private static final String KEY_SUB       = "sub_";

    private static final float[] SPEEDS        = {0.25f, 0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 1.75f, 2.0f};
    private static final String[] SPEED_LABELS = {"0.25×", "0.5×", "0.75×", "1×", "1.25×", "1.5×", "1.75×", "2×"};
    private int currentSpeedIdx = 3; // 1.0×

    // ── Player ─────────────────────────────────────────────────────────────────
    private ExoPlayer            player;
    private PlayerView           playerView;
    private DefaultTrackSelector trackSelector;
    private boolean              isZoomed = false;

    // ── Views ──────────────────────────────────────────────────────────────────
    private FrameLayout  controlsContainer;
    private FrameLayout  lockOverlay;
    private FrameLayout  episodePanel;
    private LinearLayout episodeListContainer;
    private ImageButton  btnBack, btnPip, btnPlayPause;
    private ImageButton  btnTracks, btnLock, btnUnlock;
    private ImageButton  btnEpisodes, btnCloseEpisodes;
    private TextView     tvTitle, tvTime, btnSpeed;
    private TextView     tvSeekLeft, tvSeekRight;
    private SeekBar      seekBar;
    private ProgressBar  bufferingIndicator;

    // Brightness indicator (left)
    private LinearLayout brightnessIndicator;
    private View         brightnessFill;
    private TextView     brightnessValue;

    // Volume indicator (right)
    private LinearLayout volumeIndicator;
    private View         volumeFill;
    private TextView     volumeValue;

    // ── State ──────────────────────────────────────────────────────────────────
    private boolean controlsVisible   = true;
    private boolean isLocked          = false;
    private boolean isSeekBarTracking = false;
    private boolean isInPiP           = false;
    private boolean episodePanelOpen  = false;

    // ── Persist ────────────────────────────────────────────────────────────────
    private SharedPreferences prefs;
    private String            fileId;
    private String            currentAudioLang = "";
    private String            currentSubLang   = "";

    // ── Gestures ───────────────────────────────────────────────────────────────
    private GestureDetector      gestureDetector;
    private ScaleGestureDetector scaleGestureDetector;
    private AudioManager         audioManager;
    private float gestureStartY;
    private float gestureStartVolume;
    private float gestureStartBrightness;
    private boolean gestureIsBrightness;
    private boolean isScaling = false;
    private int     screenWidth;
    private int     screenHeight;

    // ── Tracks ─────────────────────────────────────────────────────────────────
    private final List<TrackGroup> audioGroups    = new ArrayList<>();
    private final List<TrackGroup> subtitleGroups = new ArrayList<>();
    private int currentAudioGroupIdx    = -1;
    private int currentSubtitleGroupIdx = -1;

    // ── Preferences ────────────────────────────────────────────────────────────
    private String preferredAudio = "";
    private String preferredSub   = "";

    // ── Episodes ───────────────────────────────────────────────────────────────
    private final List<EpisodeItem> episodes = new ArrayList<>();

    // ── Handler / Runnables ────────────────────────────────────────────────────
    private final Handler  handler              = new Handler(Looper.getMainLooper());
    private final Runnable immersiveRunnable    = this::setImmersiveMode;
    private final Runnable hideControlsRunnable = this::hideControls;
    private final Runnable hideGestureRunnable  = () -> {
        brightnessIndicator.setVisibility(View.GONE);
        volumeIndicator.setVisibility(View.GONE);
    };
    private final Runnable updateTimeRunnable = new Runnable() {
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

        String url   = getIntent().getStringExtra(EXTRA_URL);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        fileId        = getIntent().getStringExtra(EXTRA_FILE_ID);
        preferredAudio = nvl(getIntent().getStringExtra(EXTRA_PREFERRED_AUDIO));
        preferredSub   = nvl(getIntent().getStringExtra(EXTRA_PREFERRED_SUB));
        String episodesJson = nvl(getIntent().getStringExtra(EXTRA_EPISODES_JSON));

        prefs        = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        screenWidth  = getResources().getDisplayMetrics().widthPixels;
        screenHeight = getResources().getDisplayMetrics().heightPixels;

        // Restore saved track preferences if available
        if (fileId != null && !fileId.isEmpty()) {
            String savedAudio = prefs.getString(KEY_AUDIO + fileId, null);
            String savedSub   = prefs.getString(KEY_SUB   + fileId, null);
            if (savedAudio != null && !savedAudio.isEmpty()) preferredAudio = savedAudio;
            if (savedSub   != null)                           preferredSub   = savedSub;
        }

        bindViews();
        tvTitle.setText(title != null ? title : "");
        parseEpisodes(episodesJson);

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

    @Override protected void onResume()  { super.onResume(); setImmersiveMode(); }
    @Override public void onWindowFocusChanged(boolean h) {
        super.onWindowFocusChanged(h);
        if (h) setImmersiveMode();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (!isInPiP && player != null) player.pause();
    }

    @Override
    protected void onStop() {
        super.onStop();
        savePositionAndReport();
        releasePlayer();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
    }

    @Override
    public void onBackPressed() {
        if (episodePanelOpen) { hideEpisodePanel(); return; }
        if (isInPiP) { finish(); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && player != null && player.isPlaying()) {
            enterPiP();
        } else {
            savePositionAndReport();
            finish();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Player initialisation
    // ══════════════════════════════════════════════════════════════════════════

    private void initializePlayer(String url) {
        DefaultRenderersFactory rf = new DefaultRenderersFactory(this)
                .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
                .setEnableDecoderFallback(true);

        trackSelector = new DefaultTrackSelector(this);
        DefaultTrackSelector.Parameters.Builder params = trackSelector.getParameters().buildUpon();
        if (!preferredAudio.isEmpty()) params.setPreferredAudioLanguage(toIsoCode(preferredAudio));
        if (!preferredSub.isEmpty() && !preferredSub.equalsIgnoreCase("null")) {
            params.setPreferredTextLanguage(toIsoCode(preferredSub));
        } else {
            params.setIgnoredTextSelectionFlags(C.SELECTION_FLAG_DEFAULT | C.SELECTION_FLAG_AUTOSELECT);
        }
        trackSelector.setParameters(params.build());

        player = new ExoPlayer.Builder(this, rf).setTrackSelector(trackSelector).build();
        playerView.setPlayer(player);
        player.addListener(this);

        MediaItem item;
        if (url.contains(".m3u8")) {
            item = new MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_M3U8).build();
        } else if (url.contains(".mpd")) {
            item = new MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_MPD).build();
        } else {
            item = MediaItem.fromUri(url);
        }
        player.setMediaItem(item);
        player.prepare();

        if (fileId != null && !fileId.isEmpty()) {
            long saved = prefs.getLong(KEY_POS + fileId, 0);
            if (saved > 5_000) player.seekTo(saved);
        }
        player.setPlayWhenReady(true);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Player.Listener callbacks
    // ══════════════════════════════════════════════════════════════════════════

    @Override
    public void onPlaybackStateChanged(int state) {
        switch (state) {
            case Player.STATE_BUFFERING: bufferingIndicator.setVisibility(View.VISIBLE); break;
            case Player.STATE_READY:
                bufferingIndicator.setVisibility(View.GONE);
                refreshPlayPauseIcon();
                break;
            case Player.STATE_ENDED:
                bufferingIndicator.setVisibility(View.GONE);
                showControls();
                break;
            default: bufferingIndicator.setVisibility(View.GONE);
        }
    }

    @Override
    public void onIsPlayingChanged(boolean isPlaying) {
        refreshPlayPauseIcon();
        if (isPlaying) scheduleHideControls();
        else { handler.removeCallbacks(hideControlsRunnable); showControls(); }
    }

    @Override
    public void onTracksChanged(@NonNull Tracks tracks) {
        audioGroups.clear();
        subtitleGroups.clear();
        currentAudioGroupIdx    = -1;
        currentSubtitleGroupIdx = -1;

        for (Tracks.Group g : tracks.getGroups()) {
            int type = g.getType();
            if (type == C.TRACK_TYPE_AUDIO) {
                if (g.isSelected()) {
                    currentAudioGroupIdx = audioGroups.size();
                    Format fmt = g.getMediaTrackGroup().getFormat(0);
                    currentAudioLang = langName(fmt.language);
                }
                audioGroups.add(g.getMediaTrackGroup());
            } else if (type == C.TRACK_TYPE_TEXT) {
                if (g.isSelected()) {
                    currentSubtitleGroupIdx = subtitleGroups.size();
                    Format fmt = g.getMediaTrackGroup().getFormat(0);
                    currentSubLang = langName(fmt.language);
                }
                subtitleGroups.add(g.getMediaTrackGroup());
            }
        }
    }

    @Override
    public void onPlayerError(@NonNull PlaybackException error) {
        runOnUiThread(() ->
            new android.app.AlertDialog.Builder(this)
                .setTitle("Playback Error")
                .setMessage(error.getMessage())
                .setPositiveButton("Close",  (d, w) -> finish())
                .setNegativeButton("Retry",  (d, w) -> { if (player != null) player.prepare(); })
                .show()
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  View binding & controls setup
    // ══════════════════════════════════════════════════════════════════════════

    private void bindViews() {
        playerView            = findViewById(R.id.player_view);
        controlsContainer     = findViewById(R.id.controls_container);
        lockOverlay           = findViewById(R.id.lock_overlay);
        episodePanel          = findViewById(R.id.episode_panel);
        episodeListContainer  = findViewById(R.id.episode_list_container);
        btnBack               = findViewById(R.id.btn_back);
        btnPip                = findViewById(R.id.btn_pip);
        btnPlayPause          = findViewById(R.id.btn_play_pause);
        btnTracks             = findViewById(R.id.btn_tracks);
        btnSpeed              = findViewById(R.id.btn_speed);
        btnLock               = findViewById(R.id.btn_lock);
        btnUnlock             = findViewById(R.id.btn_unlock);
        btnEpisodes           = findViewById(R.id.btn_episodes);
        btnCloseEpisodes      = findViewById(R.id.btn_close_episodes);
        tvTitle               = findViewById(R.id.tv_title);
        tvTime                = findViewById(R.id.tv_time);
        tvSeekLeft            = findViewById(R.id.tv_seek_left);
        tvSeekRight           = findViewById(R.id.tv_seek_right);
        seekBar               = findViewById(R.id.seek_bar);
        bufferingIndicator    = findViewById(R.id.buffering_indicator);
        brightnessIndicator   = findViewById(R.id.brightness_indicator);
        brightnessFill        = findViewById(R.id.brightness_fill);
        brightnessValue       = findViewById(R.id.brightness_value);
        volumeIndicator       = findViewById(R.id.volume_indicator);
        volumeFill            = findViewById(R.id.volume_fill);
        volumeValue           = findViewById(R.id.volume_value);
    }

    private void setupControls() {
        btnBack.setOnClickListener(v -> onBackPressed());
        btnPip.setOnClickListener(v -> enterPiP());

        btnPlayPause.setOnClickListener(v -> {
            if (player == null) return;
            if (player.isPlaying()) player.pause(); else player.play();
            scheduleHideControls();
        });

        btnTracks.setOnClickListener(v -> {
            scheduleHideControls();
            showTracksDialog();
        });

        // Speed: click = popup menu, long-press = same
        btnSpeed.setOnClickListener(v -> {
            scheduleHideControls();
            showSpeedDialog();
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

        btnEpisodes.setOnClickListener(v -> {
            if (episodePanelOpen) hideEpisodePanel(); else showEpisodePanel();
        });

        btnCloseEpisodes.setOnClickListener(v -> hideEpisodePanel());

        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar sb, int p, boolean fromUser) {
                if (!fromUser || player == null) return;
                long dur = player.getDuration();
                if (dur > 0) {
                    long pos = (long) (dur * p / 100.0);
                    player.seekTo(pos);
                    tvTime.setText(fmtTime(pos) + " / " + fmtTime(dur));
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
    //  Gestures
    // ══════════════════════════════════════════════════════════════════════════

    @SuppressLint("ClickableViewAccessibility")
    private void setupGestures() {
        gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onSingleTapConfirmed(MotionEvent e) {
                if (!isLocked) toggleControls();
                return true;
            }
            @Override public boolean onDoubleTap(MotionEvent e) {
                if (isLocked) return true;
                float x = e.getX();
                if (x < screenWidth / 3.0f)          { seekBy(-SEEK_MS); flashSeek(false); }
                else if (x > screenWidth * 2.0f / 3) { seekBy(SEEK_MS);  flashSeek(true);  }
                else if (player != null) {
                    if (player.isPlaying()) player.pause(); else player.play();
                }
                return true;
            }
            @Override public boolean onDown(MotionEvent e) { return true; }
        });

        scaleGestureDetector = new ScaleGestureDetector(this,
                new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            private float accumulatedScale = 1f;
            @Override public boolean onScaleBegin(ScaleGestureDetector d) {
                isScaling = true;
                accumulatedScale = 1f;
                return true;
            }
            @Override public boolean onScale(ScaleGestureDetector d) {
                accumulatedScale *= d.getScaleFactor();
                return true;
            }
            @Override public void onScaleEnd(ScaleGestureDetector d) {
                isScaling = false;
                if (accumulatedScale > 1.15f && !isZoomed) {
                    isZoomed = true;
                    playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_ZOOM);
                } else if (accumulatedScale < 0.85f && isZoomed) {
                    isZoomed = false;
                    playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
                }
            }
        });
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (!isLocked) {
            scaleGestureDetector.onTouchEvent(event);
            if (!isScaling) {
                gestureDetector.onTouchEvent(event);
                handleSwipe(event);
            }
        }
        return super.dispatchTouchEvent(event);
    }

    private void handleSwipe(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                gestureStartY          = event.getY();
                gestureIsBrightness    = event.getX() < screenWidth / 2.0f;
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

                if (Math.abs(delta) < 20) break; // ignore small movements

                if (gestureIsBrightness) {
                    float b = clamp(gestureStartBrightness + fraction, 0.01f, 1f);
                    WindowManager.LayoutParams lp = getWindow().getAttributes();
                    lp.screenBrightness = b;
                    getWindow().setAttributes(lp);
                    showBrightnessIndicator(b);
                } else {
                    int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    int vol = clamp((int)(gestureStartVolume + fraction * max), 0, max);
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, vol, 0);
                    showVolumeIndicator(max > 0 ? vol * 1f / max : 0f);
                }
                break;

            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                handler.removeCallbacks(hideGestureRunnable);
                handler.postDelayed(hideGestureRunnable, 800);
                break;
        }
    }

    private void showBrightnessIndicator(float fraction) {
        brightnessIndicator.setVisibility(View.VISIBLE);
        setFillFraction(brightnessFill, fraction);
        brightnessValue.setText((int)(fraction * 100) + "%");
    }

    private void showVolumeIndicator(float fraction) {
        volumeIndicator.setVisibility(View.VISIBLE);
        setFillFraction(volumeFill, fraction);
        volumeValue.setText((int)(fraction * 100) + "%");
    }

    /** Sets the height of `fill` as a fraction of its parent FrameLayout height. */
    private void setFillFraction(final View fill, final float fraction) {
        fill.post(() -> {
            ViewGroup parent = (ViewGroup) fill.getParent();
            if (parent == null) return;
            int parentH = parent.getHeight();
            if (parentH <= 0) return;
            ViewGroup.LayoutParams lp = fill.getLayoutParams();
            lp.height = (int)(parentH * clamp(fraction, 0f, 1f));
            fill.setLayoutParams(lp);
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Combined Audio + Subtitle dialog
    // ══════════════════════════════════════════════════════════════════════════

    private void showTracksDialog() {
        int pad = dp(16);

        // Outer scroll
        ScrollView sv = new ScrollView(this);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(pad, dp(8), pad, pad);

        // Audio section
        if (!audioGroups.isEmpty()) {
            content.addView(makeSectionHeader("Audio"));
            RadioGroup rg = new RadioGroup(this);
            rg.setOrientation(RadioGroup.VERTICAL);
            for (int i = 0; i < audioGroups.size(); i++) {
                Format fmt     = audioGroups.get(i).getFormat(0);
                String label   = buildAudioLabel(fmt);
                RadioButton rb = makeRadioButton(label, i == currentAudioGroupIdx);
                final int idx  = i;
                rb.setOnClickListener(v -> {
                    currentAudioGroupIdx = idx;
                    applyAudioTrack(idx);
                    currentAudioLang = langName(audioGroups.get(idx).getFormat(0).language);
                });
                rg.addView(rb);
            }
            content.addView(rg);
            content.addView(makeDivider());
        }

        // Subtitle section
        content.addView(makeSectionHeader("Subtitles"));
        RadioGroup subRg = new RadioGroup(this);
        subRg.setOrientation(RadioGroup.VERTICAL);

        RadioButton offRb = makeRadioButton("Off", currentSubtitleGroupIdx == -1);
        offRb.setOnClickListener(v -> {
            currentSubtitleGroupIdx = -1;
            disableSubtitles();
            currentSubLang = "";
        });
        subRg.addView(offRb);

        for (int i = 0; i < subtitleGroups.size(); i++) {
            Format fmt     = subtitleGroups.get(i).getFormat(0);
            String label   = langName(fmt.language);
            RadioButton rb = makeRadioButton(label, i == currentSubtitleGroupIdx);
            final int idx  = i;
            rb.setOnClickListener(v -> {
                currentSubtitleGroupIdx = idx;
                applySubtitleTrack(idx);
                currentSubLang = langName(subtitleGroups.get(idx).getFormat(0).language);
            });
            subRg.addView(rb);
        }
        content.addView(subRg);

        sv.addView(content);

        new android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Audio & Subtitles")
            .setView(sv)
            .setNegativeButton("Close", null)
            .show();
    }

    private TextView makeSectionHeader(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(0xFFAAAAAA);
        tv.setTextSize(12f);
        tv.setAllCaps(true);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8); lp.bottomMargin = dp(4);
        tv.setLayoutParams(lp);
        return tv;
    }

    private View makeDivider() {
        View v = new View(this);
        v.setBackgroundColor(0x33FFFFFF);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(1));
        lp.topMargin = dp(8); lp.bottomMargin = dp(8);
        v.setLayoutParams(lp);
        return v;
    }

    private RadioButton makeRadioButton(String text, boolean checked) {
        RadioButton rb = new RadioButton(this);
        rb.setText(text);
        rb.setChecked(checked);
        rb.setTextColor(0xFFFFFFFF);
        rb.setTextSize(14f);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(4); lp.bottomMargin = dp(4);
        rb.setLayoutParams(lp);
        return rb;
    }

    private String buildAudioLabel(Format fmt) {
        String lang    = langName(fmt.language);
        String codec   = codecLabel(fmt.sampleMimeType);
        String layout  = fmt.channelCount > 0 ? fmt.channelCount + "ch" : "";
        String bitrate = fmt.bitrate > 0 ? Math.round(fmt.bitrate / 1000f) + " kbps" : "";
        StringBuilder sb = new StringBuilder(lang).append("  [").append(codec);
        if (!layout.isEmpty()) sb.append(" · ").append(layout);
        if (!bitrate.isEmpty()) sb.append(" · ").append(bitrate);
        return sb.append("]").toString();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Episode panel
    // ══════════════════════════════════════════════════════════════════════════

    private void parseEpisodes(String json) {
        if (json == null || json.isEmpty() || json.equals("[]")) return;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                EpisodeItem ep = new EpisodeItem();
                ep.fileId  = o.optString("fileId",  "");
                ep.url     = o.optString("url",     "");
                ep.title   = o.optString("title",   "Episode " + (i + 1));
                ep.quality = o.optString("quality", "");
                episodes.add(ep);
            }
        } catch (Exception e) {
            android.util.Log.w("VideoPlayer", "Episode JSON parse error: " + e.getMessage());
        }

        if (!episodes.isEmpty()) {
            btnEpisodes.setVisibility(View.VISIBLE);
            populateEpisodePanel();
        }
    }

    private void populateEpisodePanel() {
        episodeListContainer.removeAllViews();
        for (int i = 0; i < episodes.size(); i++) {
            EpisodeItem ep    = episodes.get(i);
            boolean isCurrent = ep.fileId.equals(fileId);

            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.VERTICAL);
            row.setPadding(dp(16), dp(12), dp(16), dp(12));
            row.setBackground(isCurrent
                ? makeRippleBackground(0x33FFFFFF)
                : makeRippleBackground(0x00000000));

            TextView title = new TextView(this);
            title.setText(ep.title);
            title.setTextColor(isCurrent ? 0xFFE50914 : 0xFFFFFFFF);
            title.setTextSize(14f);
            title.setMaxLines(2);
            row.addView(title);

            if (!ep.quality.isEmpty()) {
                TextView qual = new TextView(this);
                qual.setText(ep.quality);
                qual.setTextColor(0xFF888888);
                qual.setTextSize(12f);
                row.addView(qual);
            }

            // Divider
            View div = new View(this);
            div.setBackgroundColor(0x22FFFFFF);
            episodeListContainer.addView(row);
            episodeListContainer.addView(div, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, 1));

            if (!isCurrent) {
                final EpisodeItem finalEp = ep;
                row.setOnClickListener(v -> playEpisode(finalEp));
            }
        }
    }

    private android.graphics.drawable.ColorDrawable makeRippleBackground(int color) {
        return new android.graphics.drawable.ColorDrawable(color);
    }

    private void showEpisodePanel() {
        episodePanelOpen = true;
        episodePanel.setVisibility(View.VISIBLE);
        episodePanel.startAnimation(
            AnimationUtils.loadAnimation(this, android.R.anim.slide_in_left));
    }

    private void hideEpisodePanel() {
        episodePanelOpen = false;
        episodePanel.setVisibility(View.GONE);
    }

    private void playEpisode(EpisodeItem ep) {
        hideEpisodePanel();
        if (player == null) return;
        savePositionAndReport(); // save current position first
        fileId = ep.fileId;

        // Restore saved position for new episode
        long saved = prefs.getLong(KEY_POS + fileId, 0);

        MediaItem item;
        if (ep.url.contains(".m3u8"))      item = new MediaItem.Builder().setUri(ep.url).setMimeType(MimeTypes.APPLICATION_M3U8).build();
        else if (ep.url.contains(".mpd"))  item = new MediaItem.Builder().setUri(ep.url).setMimeType(MimeTypes.APPLICATION_MPD).build();
        else                               item = MediaItem.fromUri(ep.url);

        player.setMediaItem(item);
        player.prepare();
        if (saved > 5_000) player.seekTo(saved);
        player.setPlayWhenReady(true);

        tvTitle.setText(ep.title);
        populateEpisodePanel(); // refresh highlight
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Track application
    // ══════════════════════════════════════════════════════════════════════════

    private void applyAudioTrack(int idx) {
        if (player == null || idx >= audioGroups.size()) return;
        player.setTrackSelectionParameters(
            player.getTrackSelectionParameters().buildUpon()
                .setOverrideForType(new TrackSelectionOverride(audioGroups.get(idx), 0))
                .build());
    }

    private void applySubtitleTrack(int idx) {
        if (player == null || idx >= subtitleGroups.size()) return;
        player.setTrackSelectionParameters(
            player.getTrackSelectionParameters().buildUpon()
                .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                .setIgnoredTextSelectionFlags(0)
                .setOverrideForType(new TrackSelectionOverride(subtitleGroups.get(idx), 0))
                .build());
    }

    private void disableSubtitles() {
        if (player == null) return;
        DefaultTrackSelector.Parameters.Builder b = trackSelector.getParameters().buildUpon();
        for (TrackGroup g : subtitleGroups)
            b.addOverride(new TrackSelectionOverride(g, Collections.emptyList()));
        trackSelector.setParameters(b.build());
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Speed picker
    // ══════════════════════════════════════════════════════════════════════════

    private void showSpeedDialog() {
        new android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Playback Speed")
            .setSingleChoiceItems(SPEED_LABELS, currentSpeedIdx, (d, which) -> {
                currentSpeedIdx = which;
                applyPlaybackSpeed();
                d.dismiss();
                scheduleHideControls();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void applyPlaybackSpeed() {
        if (player == null) return;
        player.setPlaybackSpeed(SPEEDS[currentSpeedIdx]);
        btnSpeed.setText(SPEED_LABELS[currentSpeedIdx]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Controls visibility
    // ══════════════════════════════════════════════════════════════════════════

    private void toggleControls() {
        if (controlsVisible) hideControls(); else { showControls(); scheduleHideControls(); }
    }
    private void showControls()  { controlsVisible = true;  controlsContainer.setVisibility(View.VISIBLE); }
    private void hideControls()  { controlsVisible = false; controlsContainer.setVisibility(View.GONE); }
    private void scheduleHideControls() {
        handler.removeCallbacks(hideControlsRunnable);
        if (!isSeekBarTracking) handler.postDelayed(hideControlsRunnable, HIDE_DELAY_MS);
    }

    private void refreshPlayPauseIcon() {
        if (player == null) return;
        btnPlayPause.setImageResource(
            player.isPlaying() ? R.drawable.ic_player_pause : R.drawable.ic_player_play);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Time / seekbar
    // ══════════════════════════════════════════════════════════════════════════

    private void updateTimeDisplay() {
        if (player == null || isSeekBarTracking) return;
        long pos = player.getCurrentPosition();
        long dur = Math.max(0, player.getDuration());
        tvTime.setText(fmtTime(pos) + " / " + fmtTime(dur));
        seekBar.setProgress(dur > 0 ? (int)(pos * 100 / dur) : 0);
        seekBar.setSecondaryProgress(dur > 0 ? (int)(player.getBufferedPosition() * 100 / dur) : 0);
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
        player.seekTo(clamp(player.getCurrentPosition() + ms, 0L, dur > 0 ? dur : Long.MAX_VALUE));
        scheduleHideControls();
    }

    private void flashSeek(boolean forward) {
        TextView v = forward ? tvSeekRight : tvSeekLeft;
        v.setVisibility(View.VISIBLE);
        handler.postDelayed(() -> v.setVisibility(View.GONE), 700);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Picture-in-Picture
    // ══════════════════════════════════════════════════════════════════════════

    private void enterPiP() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams p = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9)).build();
            enterPictureInPictureMode(p);
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPiP, Configuration config) {
        super.onPictureInPictureModeChanged(inPiP, config);
        isInPiP = inPiP;
        if (inPiP) { controlsContainer.setVisibility(View.GONE); lockOverlay.setVisibility(View.GONE); }
        else       { showControls(); scheduleHideControls(); }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Immersive mode
    // ══════════════════════════════════════════════════════════════════════════

    @SuppressWarnings("deprecation")
    private void setImmersiveMode() {
        handler.removeCallbacks(immersiveRunnable);
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE);
        decorView.setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0) {
                handler.removeCallbacks(immersiveRunnable);
                handler.postDelayed(immersiveRunnable, 3000);
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Position save + progress report to JS
    // ══════════════════════════════════════════════════════════════════════════

    private void savePositionAndReport() {
        if (player == null || fileId == null || fileId.isEmpty()) return;
        long pos = player.getCurrentPosition();
        long dur = player.getDuration();

        SharedPreferences.Editor ed = prefs.edit();
        if (pos > 5_000 && (dur <= 0 || pos < dur - 30_000)) {
            ed.putLong(KEY_POS + fileId, pos);
        } else if (dur > 0 && pos >= dur - 30_000) {
            ed.remove(KEY_POS + fileId); // watched to end – clear
        }
        if (!currentAudioLang.isEmpty()) ed.putString(KEY_AUDIO + fileId, currentAudioLang);
        if (currentSubLang != null)      ed.putString(KEY_SUB   + fileId, currentSubLang);
        ed.apply();

        // Notify JS bridge so it can persist to server
        DbWorldPlayerPlugin plugin = DbWorldPlayerPlugin.INSTANCE;
        if (plugin != null) {
            plugin.emitPlayerStopped(fileId, pos, dur > 0 ? dur : 0,
                                     currentAudioLang, currentSubLang);
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
    //  Utility helpers
    // ══════════════════════════════════════════════════════════════════════════

    private int dp(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    private static float clamp(float v, float lo, float hi) { return v < lo ? lo : Math.min(v, hi); }
    private static int   clamp(int   v, int   lo, int   hi) { return v < lo ? lo : Math.min(v, hi); }
    private static long  clamp(long  v, long  lo, long  hi) { return v < lo ? lo : Math.min(v, hi); }

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
            default: return name.length() >= 2 ? name.substring(0, 2).toLowerCase(Locale.US) : name;
        }
    }

    private static String langName(String iso) {
        if (iso == null || iso.isEmpty()) return "Unknown";
        try {
            String n = new Locale(iso).getDisplayLanguage(Locale.ENGLISH);
            return (n == null || n.isEmpty()) ? iso.toUpperCase(Locale.US) : n;
        } catch (Exception e) { return iso.toUpperCase(Locale.US); }
    }

    private static String codecLabel(String mime) {
        if (mime == null) return "?";
        String s = mime.replace("audio/", "").replace("video/", "");
        if (s.equalsIgnoreCase("eac3") || s.equalsIgnoreCase("ec-3")) return "EAC-3";
        if (s.equalsIgnoreCase("ac-3") || s.equalsIgnoreCase("ac3"))  return "AC-3";
        return s.toUpperCase(Locale.US);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Inner classes
    // ══════════════════════════════════════════════════════════════════════════

    private static class EpisodeItem {
        String fileId, url, title, quality;
    }
}
