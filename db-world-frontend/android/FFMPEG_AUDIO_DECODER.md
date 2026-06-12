# ExoPlayer FFmpeg audio decoder (E-AC3 / AC3 / DTS / TrueHD)

The hybrid player (`HybridPlayerPlugin`) uses `NextRenderersFactory` +
`EXTENSION_RENDERER_MODE_ON`, so it tries **hardware MediaCodec decoders first and
falls back to FFmpeg software decoders** when the device can't decode a codec
(e.g. E-AC3 on phones without a Dolby hardware decoder → otherwise silent).

## Current setup: NextLib (Maven Central) — no build needed
The FFmpeg decoders come from the prebuilt, open-source **NextLib** extension
(used by Just Player / Next Player), already wired in `app/build.gradle`:

```gradle
def media3_version = "1.7.1"   // must match NextLib's media3 version
implementation "io.github.anilbeesetti:nextlib-media3ext:1.7.1-0.9.0"
```
Its version is `<media3>-<lib>`; to upgrade, bump **both** the media3 modules and
this line together (e.g. `1.10.0` + `nextlib-media3ext:1.10.0-0.12.1`). Just
rebuild the APK — nothing else to do. ABIs add a few MB to the APK.

---

## Alternative: build the official extension from source
Only if you'd rather not depend on NextLib. media3 does **not** publish a prebuilt
FFmpeg extension, so it's a native (NDK) build — run on **Linux or WSL**, against
the **same media3 version the app uses**.

## Prerequisites (Linux / WSL)
- Android **NDK r26+** and the SDK
- `git`, `make`, `pkg-config`, and an assembler (`yasm`/`nasm`)
- ~2–3 GB free disk

```bash
export NDK_PATH="$HOME/Android/Sdk/ndk/26.1.10909125"   # adjust to your NDK
export HOST_PLATFORM="linux-x86_64"                     # darwin-x86_64 on macOS
```

## 1. Clone media3 at the matching tag
```bash
git clone https://github.com/androidx/media.git
cd media
git checkout 1.3.1
MEDIA3_DIR="$(pwd)"
```

## 2. Fetch FFmpeg (the version media3 1.3.1 expects = release/6.0)
```bash
cd "$MEDIA3_DIR/libraries/decoder_ffmpeg/src/main/jni"
git clone https://github.com/FFmpeg/FFmpeg.git ffmpeg
cd ffmpeg && git checkout release/6.0 && cd ..
```

## 3. Build FFmpeg with only the decoders we need
```bash
# Audio decoders to enable. eac3 + ac3 are the must-haves for this project;
# the rest cover other tracks you may encounter.
ENABLED_DECODERS=(eac3 ac3 dca mlp truehd aac alac flac mp3 opus vorbis pcm_s16le)

./build_ffmpeg.sh \
  "$MEDIA3_DIR/libraries/decoder_ffmpeg" \
  "$NDK_PATH" \
  "$HOST_PLATFORM" \
  "${ENABLED_DECODERS[@]}"
```
This cross-compiles FFmpeg for all shipped ABIs (arm64-v8a, armeabi-v7a, x86, x86_64).

## 4. Assemble the decoder `.aar`
```bash
cd "$MEDIA3_DIR"
./gradlew :lib-decoder-ffmpeg:assembleRelease
# Output:
#   libraries/decoder_ffmpeg/build/outputs/aar/lib-decoder-ffmpeg-release.aar
```

## 5. Drop it into this app and depend on it
```bash
cp "$MEDIA3_DIR/libraries/decoder_ffmpeg/build/outputs/aar/lib-decoder-ffmpeg-release.aar" \
   db-world-frontend/android/app/libs/
```
Then in `db-world-frontend/android/app/build.gradle`, inside `dependencies { ... }`:
```gradle
    // FFmpeg software audio decoder (E-AC3/AC3/DTS fallback). Built per
    // android/FFMPEG_AUDIO_DECODER.md against media3 1.3.1.
    implementation files('libs/lib-decoder-ffmpeg-release.aar')
```
(`media3-decoder`, which the .aar needs, is already pulled in transitively by
`media3-exoplayer`.)

## 6. Verify on a device that lacks a hardware E-AC3 decoder
Rebuild + install. Play a file with an E-AC3 track on such a device — audio should
now play (via FFmpeg) instead of being silent. Devices **with** a hardware E-AC3
decoder keep using it (mode is ON = HW-first), so there's no battery/CPU cost there.

## Notes
- The `.aar` bundles native `.so` files → APK size grows by a few MB and it's
  ABI-specific. Keep it gitignored or in a release-assets store, not committed,
  unless you want it in the repo. Rebuild it whenever you bump `media3_version`.
- This makes **native** playback codec-complete. Web browsers (Chrome/Firefox)
  still can't decode E-AC3 — that's handled separately by the audio
  transcode-on-stream path (#2).
