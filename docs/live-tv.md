# Live TV

Live channels from M3U playlists: admin-managed sources, automatic health checking, and
multi-URL failover, played through the same player as the cinema library.

The defining property: **the video never touches our server.** Playback goes straight
from the channel's own CDN to the viewer's device, so Live TV costs essentially no
bandwidth — unlike the media library, where the Pi serves every byte. Everything below
follows from protecting that.

---

## Model

Three tables, and the relationship between them is the whole design.

| Table | What it is |
|---|---|
| `live_playlist` | An M3U source: an http(s) URL or a local path, re-imported on a schedule |
| `live_channel` | A logical channel — "Al Jazeera English" — independent of who carries it |
| `live_channel_source` | One playable URL. **A channel usually has several.** |

Plus two element collections, `live_channel_category` and `live_channel_language`.

Channels are keyed by **`channelKey`**: the playlist's `tvg-id` when present, else a slug
of the name. Every distinct URL for that key becomes its own source row.

That is what makes failover possible. Importing the same channel from three playlists
gives you one channel with three sources, tried health-first then by priority — not three
identical, individually unreliable tiles. (The Rust project this was modelled on dedupes
by stream URL instead, which cannot fail over at all.)

Schema is created by `ddl-auto: update`. **There is no migration SQL to run.**

---

## Import

`M3uParser` reads extended M3U and derives more than the format states:

- **Categories** — `group-title` is a **list**, not a label. iptv-org writes
  `group-title="Culture;Family"`, and 184 distinct raw values collapse to 30 real
  categories once split on `;` or `|`. The literal `Undefined` (and `Unknown`, `None`,
  `N/A`…) means "no category" and is dropped, not shown.
- **Quality** — lifted out of the name's `(1080p)` suffix and stored on the **source**,
  not the channel, because one channel is listed at several qualities as separate entries
  sharing a `tvg-id`. The suffix is stripped from the name, so the channel is titled
  "Sony Max HD" and the player cannot caption "1080p" while playing a 576p fallback.
- **Country** — from the `tvg-id` suffix (`SonyMax.in` → `IN`).
- **Brand** — the first meaningful word of the name: "Sony", "Zee", "Star".
- **Playback headers** — `#EXTVLCOPT` / `#KODIPROP` user-agent and referrer, which some
  CDNs require and without which the stream is unplayable.

Entries with a finite duration are VOD, not channels, and are skipped. `rtmp://` and
`rtsp://` parse fine but neither a browser nor our web adapter can open them, so they are
dropped at import rather than imported as channels that always fail.

### Why brand is not iptv-org's `network`

The API has a `network` field. It is a worse filter than the channel's own name:

- It covers 4,037 of 31,409 channels (13%).
- It fragments the brands people search for. Zee appears as both `Z` (45) and `Zee Media`
  (19); Star as `Star Sports`, `Star TV` and `JioStar`; Sony as `Sony Pictures Networks`.

First-word brand catches all 21 Sony channels against the API's 16, and keeps Star
together. A **word**, not a prefix — otherwise "Starlight TV" files under Star. The API's
`network` is still stored, for display only.

### Enrichment

`IptvOrgEnricher` overlays what an M3U cannot carry, joined on `tvg-id`:

| File | Gives |
|---|---|
| `channels.json` (7.9 MB) | country, network, categories — **not languages** |
| `feeds.json` (8.0 MB) | languages, as ISO 639-3, keyed on `channel` |
| `countries.json`, `languages.json` | code → display name |

Cached for `live.enrich.iptv-org.ttl-hours` (24) and loaded once per import run, not once
per playlist. **Strictly best-effort**: any failure logs a warning and the import
proceeds on parsed data alone. Set `live.enrich.iptv-org.enabled=false` to skip it
entirely — you keep quality, country and brand, and lose network and language.

### Derived vs. owned fields

Categories, brand, country and languages are **re-derived on every refresh**, unlike the
playlist-owned fields (logo, group title) which are only filled in when missing. That is
deliberate: it means a change to the splitting rules reaches channels imported before it.
An existing install only needs one **Refresh all**.

Admin overrides — `customName`, `customGroup`, `enabled`, `sortOrder` — are never touched
by an import. That is the point of keeping them in separate columns.

---

## Health checking

Public playlists rot. A large one has a substantial dead fraction at any moment: channels
that moved, were geo-blocked, or were switched off. Without probing, the grid is a list of
broken links that fail one tap at a time.

`LiveHealthService` reads the first 8 KB of each URL. A response counts as playable when
it is 2xx, non-empty, and **not a web page** — and for a `.m3u8` URL it must actually
begin with `#EXTM3U`.

The HTML rule is load-bearing in two ways. A dead endpoint commonly returns a 200 error
page; and several curated playlists list `youtube.com/<channel>/live` **as the stream
URL**, which answers 200 with ~1.4 MB of HTML. Without the check, 22 of the 32 channels in
one Indian playlist imported as healthy and played nothing.

A channel is `UP` when any enabled source is up, `DOWN` when every enabled source is down,
and `UNKNOWN` until one has a verdict. `UNKNOWN` channels are still shown — a channel
imported since the last sweep has no verdict yet, and hiding it would make a fresh
playlist look like it imported nothing.

**The sweep is bounded.** `live.health.batch-size` (400) per run, ordered
least-recently-checked first, which makes the cap a rolling sweep that still covers
everything across runs. Unbounded, a run took 492 s and was still executing when the
application shut down. Raise it for faster coverage of a large import, but every probe is
an outbound connection from the Pi.

---

## Playback

One player. `DbWorldVideoPlayer` gained a `live` mode rather than being forked — the
scrims, gestures, volume, fullscreen, PiP, rotation and sheet styling are all shared.

In live mode: the seek bar becomes an inline **LIVE** badge, the transport controls that
only make sense for a file are hidden, `seekBy` no-ops (so arrow keys and the double-tap
gesture are covered, not just the hidden buttons), the episode list becomes a channel
zapper, and **Media info** becomes **Channel info** — which reports *which source of how
many* is playing, and its host. That is the only diagnostic for a channel that keeps
dropping, and it is invisible everywhere else.

### Failover

`LivePlayerPage` holds the ordered source list. `DbWorldVideoPlayer`'s `onError` returning
`true` means "the caller is handling this", which suppresses the player's own error
overlay; the page then advances to the next URL and remounts the video layer (keyed on the
URL, so a wedged hls.js instance cannot survive the switch). A guard flag stops a burst of
fatal errors from skipping past working mirrors in milliseconds.

### HLS

- **Android** — ExoPlayer plays HLS natively; `media3-exoplayer-hls` is already a
  dependency. Nothing to do.
- **Safari / iOS** — native HLS.
- **Chrome / Firefox** — need `hls.js`, loaded via dynamic `import()` so it stays in its
  own ~595 KB lazy chunk and out of the cinema bundle.

**CORS is the real constraint on web playback.** hls.js fetches every segment with
`fetch()`, so the CDN must send `Access-Control-Allow-Origin`, and many IPTV CDNs do not.
Proxying through the Pi would fix that and destroy the feature's best property — the
video would then be our bandwidth. Don't.

---

## Scheduled jobs

Two, with deliberately different cadences, because they answer different questions.

| Job | Default | Why |
|---|---|---|
| `LivePlaylistRefresh` | every 6 h | A playlist's channel list changes on the order of days |
| `LiveHealthCheck` | every 30 min | Whether a stream *answers* changes by the minute |

Only one import may run at a time (`ReentrantLock`, reentrant so `refreshAll`'s
per-playlist calls pass through). A second caller is refused with 409 rather than queued —
it would be importing the same playlists anyway. Two concurrent imports previously
deadlocked on the unique `channel_key` index with *Lock wait timeout exceeded*. The
scheduler records a refused run as **skipped**, not failed.

---

## API

Public, unauthenticated (registered in `AppConstants.PUBLIC_GET_APIS`, GET-only):

| Endpoint | Returns |
|---|---|
| `GET /api/live/channels` | Grid tiles — **no stream URLs** |
| `GET /api/live/channels/{id}` | One channel with its ordered sources |
| `GET /api/live/groups` | Distinct categories |

The list deliberately omits sources: on a large import those are megabytes the grid never
reads. The player fetches the one channel it is about to play.

`SourceDto` has a **separate public projection** — playlist name, `lastError` and
`failCount` are operational detail and must not leave on an unauthenticated endpoint.

Admin, `@PreAuthorize(OWNER_ADMIN_AUTHORIZE)` under `/api/live/admin`: playlist CRUD +
refresh, channel patch/delete, manual channel and source add/delete, health check, stats.

`PublicEndpointMethodSecurityTest` asserts `LiveChannelController` carries **no** role
annotation (method security runs after the filter chain and would otherwise 500 an
anonymous read) and that `LiveAdminController` **keeps** one.

---

## Settings

| Property | Default | |
|---|---|---|
| `live.health.batch-size` | 400 | Sources probed per run |
| `live.health.concurrency` | 6 | Simultaneous probes; the Pi shares this uplink |
| `live.enrich.iptv-org.enabled` | true | |
| `live.enrich.iptv-org.ttl-hours` | 24 | |
| `live.enrich.iptv-org.base-url` | `https://iptv-org.github.io/api` | |

---

## Playlist sources

Verified 2026-09-18.

```
https://iptv-org.github.io/iptv/index.m3u            11,164 channels
https://iptv-org.github.io/iptv/countries/<iso2>.m3u    in: 808
https://iptv-org.github.io/iptv/categories/<id>.m3u     30 ids
https://iptv-org.github.io/iptv/languages/<iso3>.m3u    hin: 373
https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_india.m3u8   32
```

Overlapping playlists are **beneficial**, not duplicative: the same channel from two
sources merges into one channel with two URLs, which is the failover input. Give the
cleaner source a lower `priority` so its URL is tried first.

### On provenance

Worth knowing before pointing this at a public, ad-carrying domain.

`iptv-org`'s Indian list is dominated by unlicensed restreamers — top hosts are
`103.72.101.252:8080`, `cdn.pishow.tv`, `tangotv.in` and `cloudplay-sonyliv.pages.dev`.
Its Sony/Zee/Star entries are pirate feeds of paid services, and they are also the least
reliable: many carry IP-bound Akamai tokens minted for whoever scraped them, which 403
from anywhere else.

Genuinely free-to-air content in the same file is real and worth having: the 38
DD/Doordarshan channels, and `n18syndication.akamaized.net` (Network18's own CDN).

`Free-TV/IPTV` curates for legality and is markedly cleaner for India — DD family, NDTV,
ABP, India Today, Aaj Tak, TV9, on the broadcasters' own CDNs. Caveat: **22 of its 32
Indian channels are `youtube.com/…/live` URLs**, which the player cannot open. They import
and are correctly marked `DOWN`. Supporting them needs yt-dlp resolution at play time
(the resolved URLs expire within hours) — not built.
