# aria2c native binary

The download engine is the real `aria2c` program (official build, GPLv2+; source at
github.com/aria2/aria2), embedded in the APK.

**arm64-v8a is vendored** — `arm64-v8a/libaria2c.so` is committed to the repo, so fresh clones and
CI build without downloading anything (arm64 covers essentially every phone). The steps below are
only needed to **add another ABI** (32-bit ARM / x86 emulators) or to **update** the binary.

## What to place, and where

Put the aria2c executable, **renamed to `libaria2c.so`**, into the folder for each CPU ABI you
build for:

```
jniLibs/
  arm64-v8a/libaria2c.so     ← REQUIRED for essentially all modern phones
  armeabi-v7a/libaria2c.so   ← optional: old 32‑bit ARM devices
  x86_64/libaria2c.so        ← optional: emulators / x86 tablets
```

The `.so` rename + `jniLibs` location is intentional: on modern Android only files extracted into
the app's native‑library directory are allowed to be `exec()`'d, and the packager only extracts
files named `lib*.so`. `app/build.gradle` already sets `useLegacyPackaging = true` and
`keepDebugSymbols += "**/libaria2c.so"` so the binary is extracted intact.

## Which ABI does my phone need?

`arm64-v8a` for virtually every phone from the last ~8 years. To confirm:

```
adb shell getprop ro.product.cpu.abi
```

## Where to get a prebuilt aria2c for Android

**Recommended — the OFFICIAL aria2 release.** It links **OpenSSL 1.1.1w**, which has no "provider"
architecture, so it avoids the `OSSL_PROVIDER_load 'legacy' failed` startup crash (see the pitfall
below). Latest is `release-1.37.0`, arm64 only:

1. Download `aria2-1.37.0-aarch64-linux-android-build1.zip`
   from https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-aarch64-linux-android-build1.zip
2. Unzip; inside is a single `aria2c` executable (~5.8 MB, AArch64 ELF).
3. Rename it to `libaria2c.so` and place at `jniLibs/arm64-v8a/libaria2c.so`.

**⚠️ Pitfall — do NOT use the `devgianlu/aria2-android` v1.37.0 binaries here.** They statically link
**OpenSSL 3** *without* the legacy provider module, so on Android aria2 exits immediately at startup:
`[Platform.cc] errorCode=1 OSSL_PROVIDER_load 'legacy' failed` — and there's no `legacy.so` /
`libopenssl-legacy` package you can install inside an app sandbox to satisfy it.

**Other ABIs / building from source:** the official release only ships arm64. For `armeabi-v7a`,
`x86`, `x86_64`, build with the Android NDK using aria2's own `Dockerfile.android` (OpenSSL 1.1.1w),
or use a LibreSSL-based static build (e.g. `abcfy2/aria2-static-build`) — both sidestep the
OpenSSL-3 legacy-provider issue. Verify the result is statically linked and matches the ABI folder.

## Verify before shipping

The binary must be **statically linked** (no external `.so` dependencies aria2 can't find at
runtime). Quick checks on the file:

```
file libaria2c.so         # should say: ELF ... statically linked (or with only linker/libc)
readelf -d libaria2c.so   # ideally few/no NEEDED entries
```

Also make sure the ABI of the binary matches the folder it's in (an arm64 binary in `arm64-v8a`,
etc.) — a mismatch fails silently at exec time.

## Sanity check after building

- The APK grows by roughly the binary size per ABI (a few MB).
- On launch, logcat (tag `aria2`) shows the process starting and `getVersion` succeeding.
- If you see *"aria2c binary not found at …/libaria2c.so"* in logcat (tag `aria2` /
  `DbWorldDownload`), the file is missing or in the wrong ABI folder.
