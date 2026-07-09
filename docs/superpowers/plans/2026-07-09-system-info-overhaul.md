# System Info Page — Fix + Clean Refactor + Lazy Startup

- **Date:** 2026-07-09
- **Branch:** `fix/system-info-page` (off `development`)
- **Stack:** Spring Boot 4, Java 25, Raspberry Pi 5 / Ubuntu 24.04 aarch64. No OSHI — custom `/proc`+`/sys`+shell collectors.

## Problem (diagnosed)

Root cause: `RaspberryPiServerInfoCollector extends LinuxServerInfoCollector` and **overrides CPU/network/performance/services/disk/process with inferior versions**, shadowing the correct Linux logic. Plus the Spring bean does eager work at boot, and the frontend masks the rich payload with the sparse "quick" one.

Symptoms → causes:
- **CPU usage 0 / cores unreadable:** RPi `getPerformanceMetrics()` never sets `cpuUsagePercent`; quick `getBasicCpuInfo()` sets only processor count + JVM vendor ("Ubuntu"); FE `quick?.cpu ?? info?.cpu` masks the populated full payload and gates per-core on `coreDetails` (null on quick).
- **Net ↓/↑ empty:** RPi collector reads only cumulative counters — no two-sample delta (Linux version has it, shadowed).
- **JVM heap wrong:** quick `getBasicMemoryInfo()` omits `java*Formatted`; `javaTotalMemory` = committed not max; FE uses committed as the %-base.
- **`●`/"dead X.service" junk:** RPi `getRunningServices()` runs `systemctl list-units` **without `--no-legend --plain`** → the bullet shifts columns.
- **Disk I/O = 100:** `diskIOLoad = min(100, cumulative_since_boot/1000)` → always pinned; `diskReads/diskWrites` never set.
- **Slow startup:** `@PostConstruct warmupCache()` runs a full collect at boot (shell commands); all 4 collector beans instantiated though 1 is used.
- **Dead/boilerplate:** shadowed Linux methods; `createDefaultGpioPins()` fabricates 26 fake pins; `parseHatGpioMappings()` fake LED/BUTTON; double-object copy in `collect()`; duplicate `getHealthLevel`; unused `*AsMap`/`convertToMap`; double `getCameraInfo()`; FE unused `_T`/`_pct`/`DeveloperBoard` + always-"—" columns (threads/subnetMask/speed).

## Key files
- `db-world-backend/src/main/java/com/db/dbworld/app/system/info/ServerInfoService.java`
- `.../collector/ServerInfoCollector.java` (abstract base: `getBasicCpuInfo/getBasicMemoryInfo/exec/formatBytes/health`)
- `.../collector/linux/LinuxServerInfoCollector.java` (correct impls — currently shadowed on Pi)
- `.../collector/linux/RaspberryPiServerInfoCollector.java` (active on Pi; source of bugs)
- `.../collector/windows/WindowsServerInfoCollector.java`, `UnsupportedOSCollector.java`
- DTOs under `.../app/system/info/dto/**`
- `db-world-frontend/src/features/admin/system-info/index.jsx`
- `db-world-frontend/src/features/admin/api/adminApi.js` (lines ~278-288)

## Verification reality
The Pi/Linux collectors read `/proc`+`/sys` and run `vcgencmd/systemctl/ps/df/ip` — **cannot run on the Windows dev box** (it selects the Windows collector). So here: **compile (JDK 25) + unit tests for pure logic** (systemctl parse, network-delta math, byte formatting, heap math, health calc). **On-Pi verification is the user's** (boot-time + live numbers). Frontend: `npm run build` + eslint here; visual check on the Pi.

Build: `export JAVA_HOME="/c/Program Files/Java/jdk-25.0.3"; MVN=".m2/.../mvn"; cd db-world-backend && "$MVN" test`.

---

## Phase 1 — Lazy startup (no shell work at boot)
**File:** `ServerInfoService.java`
- **Remove `@PostConstruct warmupCache()`** (lines 68-76) entirely — no collection at boot. First `/api/server/*` request populates the cache; 1 s/5 s TTL still absorbs polling.
- Make the 3 non-active collectors lazy so only the detected one is instantiated. Options: annotate the collector `@Component` classes `@Lazy`, or inject `ObjectProvider<...>`/`@Lazy` constructor params and resolve only the detected one. Keep `detectCollector()` (cheap file reads) — but only call `.getObject()` on the winner.
- Verify (read) that no collector **constructor** runs shell commands; if one does, move that work out of the constructor.
- **Acceptance:** app boot performs zero `ProcessExecutor`/`exec(...)` calls from this feature; first system-info request still works. Compile clean.

## Phase 2 — Clean collector refactor (stop shadowing)
**File:** `RaspberryPiServerInfoCollector.java` (+ read `LinuxServerInfoCollector.java`, `ServerInfoCollector.java`)
- **Delete the inferior overrides** so the Pi inherits the correct Linux logic: `getCpuInfo`, `getNetworkInfo`, `getPerformanceMetrics`, `getRunningServices`, `getDiskInfo`, `getRunningProcesses`, `getBasicCpuInfo`, `getBasicMemoryInfo` — **except** keep a thin override only where it adds real Pi value, implemented as `super.method()` + augmentation:
  - **CPU:** `getCpuInfo()` = `super.getCpuInfo()` then set Pi name/vendor from `/proc/device-tree/model` (e.g. "Cortex-A76"/"BCM2712") instead of fake "ARM Processor"/"Broadcom", and overlay `currentFrequency`/`maxFrequency` from `vcgencmd measure_clock arm` / `get_config arm_freq` when available; set each `CpuCore.frequency` if cheaply available (else leave null but keep per-core load from super).
  - Everything else (network, performance, services, disk, processes, basic cpu/mem): **no override** — inherit Linux.
- Ensure `collect()` uses the (now-inherited) overridable methods for generic metrics and still assembles Pi extras (temperature, overclock, model/serial, GPIO, camera/display/HAT) into `RaspberryPiServerInfo`.
- **Delete fabricated/dead code:** `createDefaultGpioPins()` + its call (GPIO shows real pins or an empty list, never invented pins); `parseHatGpioMappings()` fake mappings (return null/empty when no real HAT); the throwaway double-object copy in `collect()`; the duplicate private `getHealthLevel(int)` (use the base); the redundant second `getCameraInfo()` call in `getPiFeatures()`.
- **Acceptance:** compile clean; RPi file materially smaller; no `model name`→"ARM Processor" / `Hardware`→"Broadcom" defaults; no fake GPIO pins.

## Phase 3 — Close remaining metric gaps
**Files:** `ServerInfoCollector.java` / `LinuxServerInfoCollector.java`
- **JVM heap:** ensure the **quick** path's `getBasicMemoryInfo()` sets `javaTotalFormatted/javaFreeFormatted/javaMaxFormatted` (currently omitted in Linux override). Expose heap so the UI can show **used = total−free**, **committed = total**, **max = max**, with **max as the %-denominator** (add a `javaUsedFormatted` + `javaHeapUsedPercent` if convenient, else compute in FE from the now-present fields).
- **Disk I/O:** replace the pinned `diskIOLoad` (cumulative/1000→min 100) with either a real rate (two `/proc/diskstats` samples) or drop `diskIOLoad`; set `diskReads/diskWrites` from `/proc/diskstats` or remove those DTO fields + FE columns rather than always-null.
- Confirm the (now inherited) Linux `getPerformanceMetrics()` sets `cpuUsagePercent` + `networkRx/TxBytesPerSec` + `networkRx/TxFormatted` on the **quick** path (it uses a cached `prevNetStats` zero-sleep delta — good; verify it initialises sanely on the first call).
- **Acceptance:** quick payload carries `performance.cpuUsagePercent`, `performance.networkRx/TxFormatted`, and `memory.java*Formatted`.

## Phase 4 — Frontend
**File:** `db-world-frontend/src/features/admin/system-info/index.jsx`
- **Fix the `quick ?? info` masking.** Rule: **structural/hardware data comes from the full `info` payload**, **live numbers overlay from `quick`**. Concretely:
  - Top CPU tile: `cpuPct = quick?.performance?.cpuUsagePercent ?? info?.performance?.cpuUsagePercent ?? info?.cpu?.loadPercentage ?? 0`.
  - `CpuTab`: read name/cores/threads/freq/cache/**coreDetails** from `info.cpu` (not `quick.cpu`); overall load from `quick.performance.cpuUsagePercent ?? info.cpu.loadPercentage`. Render the per-core grid from `info.cpu.coreDetails`.
  - `MemoryTab` heap: read `info.memory` (has formatted) or the now-populated quick; show Used / Committed / Max with Max as the bar denominator.
  - `NetworkTab`: render per-adapter rx/tx-per-sec from `info.network.adapters` (now populated); top Net ↓/↑ tiles from `quick.performance.networkRx/TxFormatted ?? info...`.
- **Remove dead code:** unused `_T`, `_pct`, `DeveloperBoard` import; drop always-"—" columns (`threads` in ProcessesTab, `subnetMask`/`speed` in NetworkTab) unless Phase 3 populates them.
- Keep polling as-is (full once + `refetchInterval` on quick 5 s / health 15 s) — but ensure full `info` is fetched so tabs have structural data (it is, once).
- **Acceptance:** `npm run build` + `npm run lint` clean for the touched file; CPU %, per-core, net speed, heap all read from populated fields.

## Phase 5 — SB4/J25 polish + tests
- In touched files: idiomatic switch/`var`/text blocks where it improves clarity; no repo-wide DTO→record rewrite (out of scope, risky).
- **Unit tests** (JUnit5 + Mockito/AssertJ, no real Pi) for pure logic extracted/testable:
  - `systemctl` line parsing (feed sample output incl. a `●`-prefixed failed unit → asserts no bogus "●" service, correct name/status).
  - network-delta rate math (two counter snapshots → bytes/sec).
  - byte formatting + JVM heap math (used/committed/max, percent vs max).
- **Acceptance:** `"$MVN" test` green; new tests cover the parse/math.

---

## On-Pi verification checklist (user, after deploy)
1. **Boot time:** compare app startup before/after — no `vcgencmd`/collector work in the boot logs; `ServerInfoService` logs collector only, no warmup collect.
2. `/api/server/info` and `/info/quick`: CPU `loadPercentage` + `performance.cpuUsagePercent` non-null and sane; per-core loads present; `network.adapters[].rxBytesPerSec`/`txBytesPerSec` + `performance.networkRx/TxFormatted` non-null after ~1 s; `memory.java*Formatted` present; `services[]` has **no** `●`/"dead X" entries; `diskIOLoad` realistic (not pinned 100).
3. Admin **System Info** page: CPU gauge + per-core populated; Net ↓/↑ show real speeds; JVM Heap shows Used/Committed/Max; Services list clean.
