package com.db.dbworld.player;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.database.ContentObserver;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.drawable.Icon;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Rational;
import android.view.TextureView;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.common.VideoSize;
import androidx.media3.common.text.CueGroup;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.LoadControl;
import androidx.media3.exoplayer.mediacodec.MediaCodecInfo;
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector;
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil;
import androidx.media3.exoplayer.upstream.DefaultAllocator;
import androidx.media3.ui.SubtitleView;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import io.github.anilbeesetti.nextlib.media3ext.ffdecoder.NextRenderersFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * PHASE-0 SPIKE — throwaway. Proves the hybrid-player architecture on-device:
 * an ExoPlayer {@link PlayerView} is inserted BEHIND the Capacitor WebView, the
 * WebView is made transparent, and a React overlay drives playback via this
 * minimal bridge (load/play/pause/seek) while receiving time/state events.
 *
 * If this renders smoothly with a working overlay, the hybrid design in
 * docs/superpowers/specs/2026-06-07-hybrid-media-player-design.md is validated.
 * This class is expected to be replaced by the real DbWorldPlayer bridge.
 */
@OptIn(markerClass = UnstableApi.class)
@CapacitorPlugin(name = "HybridPlayer")
public class HybridPlayerPlugin extends Plugin {

    private static final String TAG = "HybridPlayer";

    private ExoPlayer   player;
    private TextureView videoView;
    private SubtitleView subtitleView;   // renders the selected text track's cues over the video
    private String  currentUrl;       // for decoder-mode recreate
    private int     decoderMode = 0;  // 0 auto · 1 hardware · 2 software
    // Aspect-fit transform state — without this a raw TextureView stretches the video.
    private float videoW = 0, videoH = 0, pixelRatio = 1f, zoom = 1f;
    // Track groups by type, indexed for selection from JS.
    private final List<TrackGroup> audioGroups = new ArrayList<>();
    private final List<TrackGroup> textGroups  = new ArrayList<>();
    // Volume is mapped to the SYSTEM media stream so the in-app bar, the swipe
    // gesture, and the hardware volume keys all stay in sync.
    private AudioManager   audioManager;
    private ContentObserver volumeObserver;
    private int            lastVolPercent = -1;
    // Picture-in-Picture: a play/pause RemoteAction routed back through this receiver.
    private static final String PIP_ACTION = "com.db.dbworld.player.PIP_CONTROL";
    private BroadcastReceiver pipReceiver;
    private boolean inPip = false;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (player != null) {
                JSObject e = new JSObject();
                e.put("positionMs", Math.max(0, player.getCurrentPosition()));
                long dur = player.getDuration();
                e.put("durationMs", dur > 0 ? dur : 0);
                // Buffered (preloaded) position so the UI can draw the loaded portion of the bar.
                e.put("bufferedMs", Math.max(0, player.getBufferedPosition()));
                notifyListeners("playerTime", e);
                ui.postDelayed(this, 250);
            }
        }
    };

    @PluginMethod
    public void load(PluginCall call) {
        final String url = call.getString("url");
        Double start = call.getDouble("startMs");
        final long startMs = start != null ? start.longValue() : 0L;
        if (url == null || url.isEmpty()) { call.reject("url required"); return; }

        getActivity().runOnUiThread(() -> {
            try { doLoad(url, startMs); call.resolve(); }
            catch (Throwable t) {
                android.util.Log.e(TAG, "load failed", t);
                call.reject("load failed: " + t.getMessage());
            }
        });
    }

    /** Builds an ExoPlayer whose decoder preference matches {@link #decoderMode}. */
    private ExoPlayer buildPlayer() {
        // NextRenderersFactory is a drop-in DefaultRenderersFactory that also
        // registers the bundled FFmpeg software decoders (E-AC3/AC3/DTS/TrueHD),
        // used AFTER the platform MediaCodec ones — so audio still plays on
        // devices whose hardware can't decode the codec, instead of going silent.
        DefaultRenderersFactory rf = new NextRenderersFactory(getContext())
                .setEnableDecoderFallback(true)                  // fall back to OS decoders if HW init fails
                .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON);
        if (decoderMode == 1)      rf.setMediaCodecSelector(preferSelector(true));   // hardware first
        else if (decoderMode == 2) rf.setMediaCodecSelector(preferSelector(false));  // software first
        ExoPlayer p = new ExoPlayer.Builder(getContext(), rf)
                .setLoadControl(buildLoadControl())
                .build();
        p.addListener(playerListener);
        // Defaults before JS applies remembered prefs: prefer Hindi audio, subtitles off.
        p.setTrackSelectionParameters(
                p.getTrackSelectionParameters().buildUpon()
                        .setPreferredAudioLanguage("hin")
                        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                        .build());
        return p;
    }

    /**
     * Buffer policy tuned for large high-bitrate files (4K remuxes, 40–100 Mbps)
     * streamed over HTTP from the self-hosted CDN.
     *
     * ExoPlayer's DEFAULT LoadControl caps the forward buffer by BYTES
     * (DEFAULT_TARGET_BUFFER_BYTES), which at 4K bitrates fills in ~2–3 seconds —
     * so any brief HDD-seek or bandwidth dip drains it and the video stalls.
     *
     * We raise the byte ceiling to 96 MB (≈13 s at 60 Mbps, ≈40 s at 20 Mbps) and
     * widen the time window to up to 2 minutes, so the player builds a deep cushion
     * whenever the link has spare headroom and rides through spikes without
     * rebuffering. {@code prioritizeTimeOverSizeThresholds=false} keeps the 96 MB
     * cap authoritative so a very high-bitrate file can't OOM a low-RAM phone.
     * A 30 s back-buffer makes the player's −10 s seeks instant (no re-download).
     */
    private LoadControl buildLoadControl() {
        return new DefaultLoadControl.Builder()
                // 64 KB allocation segments — fewer, larger blocks for big media.
                .setAllocator(new DefaultAllocator(true, 64 * 1024))
                .setBufferDurationsMs(
                        30_000,   // minBufferMs — keep refilling until 30 s buffered
                        120_000,  // maxBufferMs — buffer up to 2 min when bandwidth allows
                        2_500,    // bufferForPlaybackMs — start fast (2.5 s)
                        7_000)    // bufferForPlaybackAfterRebufferMs — refill more after a stall to avoid stutter loops
                .setTargetBufferBytes(96 * 1024 * 1024)   // 96 MB ceiling (vs ~tiny default at 4K bitrates)
                .setPrioritizeTimeOverSizeThresholds(false) // byte cap stays authoritative → OOM-safe
                .setBackBuffer(30_000, true)                // retain 30 s behind for instant −10 s seeks
                .build();
    }

    /** MediaCodecSelector that orders OS software decoders first or last. */
    private MediaCodecSelector preferSelector(boolean preferHardware) {
        return (mime, requiresSecure, requiresTunneling) -> {
            List<MediaCodecInfo> infos =
                    new ArrayList<>(MediaCodecUtil.getDecoderInfos(mime, requiresSecure, requiresTunneling));
            infos.sort((a, b) -> {
                int aw = a.softwareOnly ? 1 : 0, bw = b.softwareOnly ? 1 : 0;
                return preferHardware ? Integer.compare(aw, bw)   // software last
                                      : Integer.compare(bw, aw);  // software first
            });
            return infos;
        };
    }

    private void doLoad(String url, long startMs) {
        if (player == null) player = buildPlayer();
        ensureAudio();   // system-volume sync + route hardware keys to media
        attachSurface(); // creates the TextureView and binds it to the player
        currentUrl = url;
        player.setMediaItem(MediaItem.fromUri(url));
        player.prepare();
        if (startMs > 0) player.seekTo(startMs);
        player.setPlayWhenReady(true);
        ui.removeCallbacks(ticker);
        ui.post(ticker);
        android.util.Log.d(TAG, "load ok url=" + url);
    }

    @PluginMethod
    public void play(PluginCall call)  { runOnPlayer(() -> player.setPlayWhenReady(true));  call.resolve(); }

    @PluginMethod
    public void pause(PluginCall call) { runOnPlayer(() -> player.setPlayWhenReady(false)); call.resolve(); }

    @PluginMethod
    public void seekTo(PluginCall call) {
        // Read as double: a JS number arrives as Integer and call.getLong() would
        // silently return the default (0), making every seek jump to the start.
        Double pos = call.getDouble("positionMs");
        final long ms = pos != null ? pos.longValue() : 0L;
        runOnPlayer(() -> player.seekTo(ms));
        call.resolve();
    }

    @PluginMethod
    public void selectAudioTrack(PluginCall call) {
        final Integer id = call.getInt("id");
        runOnPlayer(() -> {
            if (id != null && id >= 0 && id < audioGroups.size()) {
                player.setTrackSelectionParameters(
                        player.getTrackSelectionParameters().buildUpon()
                                .setOverrideForType(new TrackSelectionOverride(audioGroups.get(id), 0))
                                .build());
            }
        });
        call.resolve();
    }

    /** id < 0 (or null) turns subtitles off. */
    @PluginMethod
    public void selectTextTrack(PluginCall call) {
        final Integer id = call.getInt("id");
        runOnPlayer(() -> {
            if (id == null || id < 0) {
                player.setTrackSelectionParameters(
                        player.getTrackSelectionParameters().buildUpon()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                                .build());
            } else if (id < textGroups.size()) {
                player.setTrackSelectionParameters(
                        player.getTrackSelectionParameters().buildUpon()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                                .setOverrideForType(new TrackSelectionOverride(textGroups.get(id), 0))
                                .build());
            }
        });
        call.resolve();
    }

    /** mode: 'auto' · 'hw' (hardware-first) · 'sw' (software-first). Recreates the player live. */
    @PluginMethod
    public void setDecoderMode(PluginCall call) {
        String mode = call.getString("mode", "auto");
        final int m = "hw".equals(mode) ? 1 : "sw".equals(mode) ? 2 : 0;
        getActivity().runOnUiThread(() -> {
            if (m != decoderMode) {
                decoderMode = m;
                if (player != null && currentUrl != null) {
                    long pos = player.getCurrentPosition();
                    String url = currentUrl;
                    player.release();
                    player = null;
                    doLoad(url, pos);
                }
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void setRate(PluginCall call) {
        Double r = call.getDouble("rate");
        final float rate = r != null ? r.floatValue() : 1f;
        runOnPlayer(() -> player.setPlaybackSpeed(rate));
        call.resolve();
    }

    /** Sets the SYSTEM media volume (STREAM_MUSIC) so the in-app bar, the swipe
     *  gesture, and the hardware volume keys stay in sync. ExoPlayer's own gain
     *  stays at its default of 1. */
    @PluginMethod
    public void setVolume(PluginCall call) {
        Double v = call.getDouble("value");
        final float vol = v != null ? Math.max(0f, Math.min(1f, v.floatValue())) : 1f;
        getActivity().runOnUiThread(() -> {
            ensureAudio();
            int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int idx = Math.round(vol * max);
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, idx, 0);
            lastVolPercent = max > 0 ? Math.round((idx * 100f) / max) : 0;
        });
        call.resolve();
    }

    /** Current system media volume as 0..1 — used to initialise the in-app bar. */
    @PluginMethod
    public void getVolume(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ensureAudio();
            int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int cur = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
            JSObject r = new JSObject();
            r.put("value", max > 0 ? (cur / (float) max) : 1f);
            call.resolve(r);
        });
    }

    /** Screen brightness 0..1 for this window (resets to system default on release). */
    @PluginMethod
    public void setBrightness(PluginCall call) {
        Double v = call.getDouble("value");
        final float b = v != null ? Math.max(0.01f, Math.min(1f, v.floatValue())) : 0.5f;
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.screenBrightness = b;
            w.setAttributes(lp);
        });
        call.resolve();
    }

    /** Pinch zoom factor 1..3 applied on top of the aspect-fit transform. */
    @PluginMethod
    public void setZoom(PluginCall call) {
        Double z = call.getDouble("scale");
        zoom = z != null ? (float) Math.max(1.0, Math.min(3.0, z)) : 1f;
        getActivity().runOnUiThread(this::applyTransform);
        call.resolve();
    }

    /** mode: 'sensor' (auto-rotate) · 'portrait' · 'landscape' · 'locked' (lock current). */
    @PluginMethod
    public void setOrientation(PluginCall call) {
        final String mode = call.getString("mode", "sensor");
        getActivity().runOnUiThread(() -> {
            int o;
            switch (mode) {
                // SENSOR_* allows BOTH orientations of that axis (e.g. landscape can flip
                // to either side as the device rotates), instead of locking to one side.
                case "portrait":  o = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;  break;
                case "landscape": o = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE; break;
                case "locked":    o = ActivityInfo.SCREEN_ORIENTATION_LOCKED;    break;
                default:          o = ActivityInfo.SCREEN_ORIENTATION_SENSOR;    break;
            }
            getActivity().setRequestedOrientation(o);
        });
        call.resolve();
    }

    /** Enter Android Picture-in-Picture with a play/pause action. No-op below API 26. */
    @PluginMethod
    public void enterPip(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && player != null) {
                registerPipReceiver();
                try { getActivity().enterPictureInPictureMode(buildPipParams()); }
                catch (Exception e) { android.util.Log.w(TAG, "enterPip failed", e); }
            }
        });
        call.resolve();
    }

    /** Invoked by MainActivity.onPictureInPictureModeChanged — tell the React overlay to hide/show. */
    public void handlePipModeChanged(boolean isInPip) {
        inPip = isInPip;
        JSObject e = new JSObject();
        e.put("pip", isInPip);
        notifyListeners("playerPipChanged", e);
        if (!isInPip) unregisterPipReceiver();
    }

    @PluginMethod
    public void release(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ui.removeCallbacks(ticker);
            if (player != null) { player.release(); player = null; }
            detachSurface();
            unregisterVolumeObserver();
            unregisterPipReceiver();
            getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            Window w = getActivity().getWindow();
            w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // allow the screen to sleep again
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE; // back to system
            w.setAttributes(lp);
        });
        call.resolve();
    }

    // ─── internals ──────────────────────────────────────────────────────────

    private void attachSurface() {
        WebView webView = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (videoView == null) {
            // TextureView composites within the view hierarchy (respects alpha/z-order),
            // so it shows correctly BEHIND a transparent WebView — unlike a SurfaceView,
            // whose separate compositor layer doesn't reliably show through.
            videoView = new TextureView(getContext());
            // Re-fit the video whenever the view is (re)laid out, e.g. on rotation.
            videoView.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> applyTransform());
        }
        if (videoView.getParent() == null) {
            parent.addView(videoView, 0, new ViewGroup.LayoutParams(   // index 0 = behind WebView
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        // Subtitle layer: sits directly ABOVE the video TextureView but still BEHIND the
        // transparent WebView, so cues composite over the video and show through the React
        // overlay. setUserDefault* honours the device's system caption style/size.
        if (subtitleView == null) {
            subtitleView = new SubtitleView(getContext());
            subtitleView.setUserDefaultStyle();
            subtitleView.setUserDefaultTextSize();
        }
        if (subtitleView.getParent() == null) {
            parent.addView(subtitleView, 1, new ViewGroup.LayoutParams(   // index 1 = above video, below WebView
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        player.setVideoTextureView(videoView);
        // Make the WebView (and its page) see-through so the video shows behind the overlay,
        // and paint the area behind the video black so letterbox/pillarbox bars are black
        // (not the app's grey window background).
        webView.setBackgroundColor(Color.TRANSPARENT);
        parent.setBackgroundColor(Color.BLACK);
    }

    private void detachSurface() {
        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.WHITE);
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent != null) parent.setBackgroundColor(Color.TRANSPARENT);
        if (player != null) player.clearVideoTextureView(videoView);
        if (videoView != null && videoView.getParent() != null) {
            ((ViewGroup) videoView.getParent()).removeView(videoView);
        }
        if (subtitleView != null && subtitleView.getParent() != null) {
            ((ViewGroup) subtitleView.getParent()).removeView(subtitleView);
        }
    }

    private void runOnPlayer(Runnable r) {
        getActivity().runOnUiThread(() -> { if (player != null) r.run(); });
    }

    /** Lazily grabs AudioManager, routes hardware volume keys to the media
     *  stream, and starts observing system-volume changes (hardware keys). */
    private void ensureAudio() {
        if (audioManager == null) {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        }
        getActivity().setVolumeControlStream(AudioManager.STREAM_MUSIC);
        registerVolumeObserver();
    }

    private void registerVolumeObserver() {
        if (volumeObserver != null || audioManager == null) return;
        int max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int cur = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        lastVolPercent = max > 0 ? Math.round((cur * 100f) / max) : 0;
        volumeObserver = new ContentObserver(ui) {
            @Override public void onChange(boolean selfChange, Uri uri) {
                if (audioManager == null) return;
                int mx = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                int c  = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                int pct = mx > 0 ? Math.round((c * 100f) / mx) : 0;
                if (pct == lastVolPercent) return;   // not a media-volume change
                lastVolPercent = pct;
                JSObject e = new JSObject();
                e.put("value", mx > 0 ? (c / (float) mx) : 1f);
                notifyListeners("playerVolume", e);
            }
        };
        getContext().getContentResolver()
                .registerContentObserver(Settings.System.CONTENT_URI, true, volumeObserver);
    }

    private void unregisterVolumeObserver() {
        if (volumeObserver != null) {
            try { getContext().getContentResolver().unregisterContentObserver(volumeObserver); }
            catch (Exception ignored) { }
            volumeObserver = null;
        }
    }

    /** Hold the screen awake only while video is actually playing. */
    private void setKeepScreenOn(boolean on) {
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            if (on) w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else    w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
    }

    private static boolean isDecoderError(PlaybackException e) {
        int c = e.errorCode;
        return c == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED
            || c == PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED
            || c == PlaybackException.ERROR_CODE_DECODING_FAILED
            || c == PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED
            || c == PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES;
    }

    private static String langName(String code) {
        if (code == null || code.isEmpty()) return "Unknown";
        switch (code.toLowerCase()) {
            case "hin": case "hi": return "Hindi";
            case "eng": case "en": return "English";
            case "tam": case "ta": return "Tamil";
            case "tel": case "te": return "Telugu";
            case "mal": case "ml": return "Malayalam";
            case "kan": case "kn": return "Kannada";
            case "ben": case "bn": return "Bengali";
            case "mar": case "mr": return "Marathi";
            case "pan": case "pa": return "Punjabi";
            case "guj": case "gu": return "Gujarati";
            case "urd": case "ur": return "Urdu";
            case "spa": case "es": return "Spanish";
            case "fra": case "fre": case "fr": return "French";
            case "deu": case "ger": case "de": return "German";
            case "jpn": case "ja": return "Japanese";
            case "kor": case "ko": return "Korean";
            case "zho": case "chi": case "zh": return "Chinese";
            default:
                try { return new java.util.Locale(code).getDisplayLanguage(); }
                catch (Exception e) { return code; }
        }
    }

    /** Short display codec name from an ExoPlayer sampleMimeType (e.g. audio/eac3 → E-AC3). */
    private static String codecName(String mime) {
        if (mime == null) return null;
        String m = mime.toLowerCase();
        if (m.contains("eac3") || m.contains("e-ac3"))     return "E-AC3";
        if (m.contains("ac4"))                             return "AC4";
        if (m.contains("ac3"))                             return "AC3";
        if (m.contains("truehd") || m.contains("true-hd")) return "TrueHD";
        if (m.contains("dts"))                             return "DTS";
        if (m.contains("mp4a") || m.contains("aac"))       return "AAC";
        if (m.contains("opus"))                            return "Opus";
        if (m.contains("flac"))                            return "FLAC";
        if (m.contains("mpeg") || m.contains("mp3"))       return "MP3";
        if (m.contains("vorbis"))                          return "Vorbis";
        if (m.contains("raw") || m.contains("pcm"))        return "PCM";
        int slash = mime.indexOf('/');   // audio/xyz → XYZ
        return slash >= 0 ? mime.substring(slash + 1).toUpperCase() : mime.toUpperCase();
    }

    // ─── Picture-in-Picture ───────────────────────────────────────────────────

    private PictureInPictureParams buildPipParams() {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder();
        int w = (int) Math.max(1, videoW * pixelRatio), h = (int) Math.max(1, videoH);
        // Android rejects extreme ratios (allowed ≈ 0.42…2.39) — clamp to be safe.
        double ratio = (h > 0) ? (double) w / h : (16.0 / 9.0);
        ratio = Math.max(0.42, Math.min(2.38, ratio));
        b.setAspectRatio(new Rational((int) Math.round(ratio * 1000), 1000));
        if (videoView != null && videoView.getWidth() > 0) {
            int[] loc = new int[2];
            videoView.getLocationOnScreen(loc);
            b.setSourceRectHint(new Rect(loc[0], loc[1], loc[0] + videoView.getWidth(), loc[1] + videoView.getHeight()));
        }
        b.setActions(java.util.Collections.singletonList(playPauseAction()));
        return b.build();
    }

    /** The single PiP-window action, reflecting the current play/pause state. */
    private RemoteAction playPauseAction() {
        boolean playing = player != null && player.getPlayWhenReady();
        int iconRes = playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String title = playing ? "Pause" : "Play";
        Intent i = new Intent(PIP_ACTION).setPackage(getContext().getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(getContext(), 1, i, flags);
        return new RemoteAction(Icon.createWithResource(getContext(), iconRes), title, title, pi);
    }

    private void registerPipReceiver() {
        if (pipReceiver != null) return;
        pipReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context ctx, Intent intent) {
                if (player == null) return;
                player.setPlayWhenReady(!player.getPlayWhenReady());
                updatePipActions();
            }
        };
        IntentFilter filter = new IntentFilter(PIP_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(pipReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(pipReceiver, filter);
        }
    }

    private void unregisterPipReceiver() {
        if (pipReceiver != null) {
            try { getContext().unregisterReceiver(pipReceiver); } catch (Exception ignored) {}
            pipReceiver = null;
        }
    }

    /** Refresh the PiP action so its icon tracks play↔pause while in PiP. */
    private void updatePipActions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && inPip) {
            try { getActivity().setPictureInPictureParams(buildPipParams()); } catch (Exception ignored) {}
        }
    }

    private void applyTransform() {
        if (videoView == null || videoW <= 0 || videoH <= 0) return;
        int vw = videoView.getWidth(), vh = videoView.getHeight();
        if (vw == 0 || vh == 0) return;
        float videoAspect = (videoW * pixelRatio) / videoH;
        float viewAspect  = (float) vw / vh;
        float sx = 1f, sy = 1f;
        if (videoAspect > viewAspect) sy = viewAspect / videoAspect; // letterbox (bars top/bottom)
        else                          sx = videoAspect / viewAspect; // pillarbox (bars left/right)
        Matrix m = new Matrix();
        m.setScale(sx * zoom, sy * zoom, vw / 2f, vh / 2f);          // zoom multiplies the fit
        videoView.setTransform(m);
        // Force a re-composite so the transform shows even while paused (a paused
        // TextureView receives no new frames and wouldn't otherwise repaint).
        videoView.invalidate();
    }

    private void emitTracks(Tracks tracks) {
        audioGroups.clear();
        textGroups.clear();
        JSArray audio = new JSArray();
        JSArray text  = new JSArray();
        int selAudio = -1, selText = -1;
        for (Tracks.Group g : tracks.getGroups()) {
            int type = g.getType();
            if (type == C.TRACK_TYPE_AUDIO) {
                int id = audioGroups.size();
                TrackGroup tg = g.getMediaTrackGroup();
                Format f = tg.getFormat(0);
                JSObject o = new JSObject();
                o.put("id", id);
                // Null language → leave null so the JS label falls back to codec/title;
                // a fallback/unsupported track no longer renders as "Default"/"Unknown".
                o.put("language", f.language != null ? langName(f.language) : null);
                if (f.label != null) o.put("title", f.label);
                o.put("codec", codecName(f.sampleMimeType));
                o.put("channels", f.channelCount > 0 ? f.channelCount : 0);
                if (f.bitrate > 0) o.put("bitRate", f.bitrate);        // bps → JS shows kbps
                if (f.sampleRate > 0) o.put("sampleRate", f.sampleRate); // Hz → JS shows kHz
                audio.put(o);
                if (g.isSelected()) selAudio = id;
                audioGroups.add(tg);
            } else if (type == C.TRACK_TYPE_TEXT) {
                int id = textGroups.size();
                TrackGroup tg = g.getMediaTrackGroup();
                Format f = tg.getFormat(0);
                JSObject o = new JSObject();
                o.put("id", id);
                o.put("language", f.language != null ? langName(f.language) : null);
                if (f.label != null) o.put("title", f.label);
                o.put("format", f.sampleMimeType);   // → JS maps to SRT / PGS / ASS / VTT…
                o.put("forced", (f.selectionFlags & C.SELECTION_FLAG_FORCED) != 0);
                text.put(o);
                if (g.isSelected()) selText = id;
                textGroups.add(tg);
            }
        }
        JSObject e = new JSObject();
        e.put("audio", audio);
        e.put("text", text);
        e.put("selectedAudio", selAudio);
        e.put("selectedText", selText);
        notifyListeners("playerTracks", e);
    }

    private final Player.Listener playerListener = new Player.Listener() {
        @Override public void onIsPlayingChanged(boolean isPlaying) {
            // Keep the screen on only while actually playing; let it sleep when paused.
            setKeepScreenOn(isPlaying);
            // Mirror the real play/pause to the UI so the button icon can't desync.
            JSObject e = new JSObject();
            e.put("playing", isPlaying);
            notifyListeners("playerState", e);
            updatePipActions();   // keep the PiP-window play/pause icon in sync too
        }
        @Override public void onTracksChanged(@NonNull Tracks tracks) {
            emitTracks(tracks);
        }
        // Draw the decoded subtitle cues (empty list when subtitles are off / none selected).
        // Without this sink the selected text track is decoded but never rendered anywhere.
        @Override public void onCues(@NonNull CueGroup cueGroup) {
            if (subtitleView != null) subtitleView.setCues(cueGroup.cues);
        }
        @Override public void onVideoSizeChanged(@NonNull VideoSize vs) {
            videoW = vs.width; videoH = vs.height;
            pixelRatio = vs.pixelWidthHeightRatio > 0 ? vs.pixelWidthHeightRatio : 1f;
            ui.post(HybridPlayerPlugin.this::applyTransform);
        }
        @Override public void onPlaybackStateChanged(int state) {
            JSObject e = new JSObject();
            e.put("state", state); // 1 IDLE, 2 BUFFERING, 3 READY, 4 ENDED
            notifyListeners("playerState", e);
            if (state == Player.STATE_ENDED) notifyListeners("playerEnded", new JSObject());
        }
        @Override public void onPlayerError(@NonNull PlaybackException error) {
            // Auto-fallback: a hardware/decoder failure retries once with software decoders.
            if (isDecoderError(error) && decoderMode != 2 && currentUrl != null) {
                final long pos = player != null ? player.getCurrentPosition() : 0;
                final String url = currentUrl;
                decoderMode = 2;
                JSObject info = new JSObject();
                info.put("message", "Hardware decoder unavailable — switched to software");
                notifyListeners("playerInfo", info);
                ui.post(() -> {
                    if (player != null) { player.release(); player = null; }
                    doLoad(url, pos);
                });
                return;
            }
            JSObject e = new JSObject();
            e.put("code", error.errorCode);
            e.put("message", error.getMessage());
            notifyListeners("playerError", e);
        }
    };

    @Override
    protected void handleOnDestroy() {
        ui.removeCallbacks(ticker);
        unregisterVolumeObserver();
        unregisterPipReceiver();
        if (player != null) { player.release(); player = null; }
        try { getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); }
        catch (Exception ignored) { }
        super.handleOnDestroy();
    }
}
