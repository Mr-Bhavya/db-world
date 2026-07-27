# IPO Tracker — Poll · Store · Notify (inside db-world)

- **Date:** 2026-07-23
- **Host:** Inside db-world (Spring Boot backend + MySQL + React frontend), reusing the
  existing scheduler, `notify.*` toast system, and push-notification stack.
- **Suggested branch:** `feat/ipo-tracker` (off `development`) — not yet created.
- **Status:** Design / analysis — not yet approved for implementation planning.
- **Author:** Claude (Opus 4.8) with bhavya.dudhia

---

## 1. Goal

Track Indian IPOs on a schedule and surface them on a page that stays **auto-current**. The
system polls 2–3 free data sources, merges them into one clean record per IPO, stores current
state plus **time-series history** (GMP and subscription), detects changes, and fires
**notifications**. It also covers **allotment status** at two levels (see §7) and renders a
**GMP-over-time chart** with both ₹ and % axes (§8).

> **Freshness reality:** data is fresh *as of the last successful poll* — not live. Freshness
> is bounded by the poll interval. The site therefore shows a **"Last updated HH:MM IST"**
> stamp so users understand the lag. Near-real-time would require a webhook/push source (paid);
> the architecture supports swapping ingestion later without other changes.

---

## 2. Data flow

```
[IPO Guru]  [NSE]  [Chittorgarh]      ← 3 free source adapters (IpoSource impls)
      │        │          │
      └────► Normalizer ─────►  Merge / precedence layer   (one record per IPO)
                                        │
      ┌──────────────┬──────────────────┼────────────────────┬───────────────┐
      ▼              ▼                   ▼                     ▼               ▼
 ipo_listing   ipo_gmp_history   ipo_subscription_history  change detect   ipo_source_poll
  (current)     (time series)        (time series)             │            (freshness/health)
                                                  Android push + Web push (no in-app toast)
      │
      ▼
 REST API ─► React user page (list · detail · GMP chart · allotment · "last updated")
          └► React admin page (source health · cadence config · manual re-poll)
```

---

## 3. Data sources (all free)

| Source | Best at | Access |
|---|---|---|
| **IPO Guru** (primary) | GMP, subscription (QIB/NII/Retail), full details, listing exchange | Free key **(requested from IPO Guru — pending)**, `X-API-KEY`, 15/min · 300/day, JSON. Base `https://www.ipoguru.in/api/v1`, `GET /ipos?type=&status=` |
| **NSE** (authoritative) | Dates, status, listing venue + listing price | Free but needs cookie-priming + real User-Agent + referer to defeat anti-bot |
| **Chittorgarh** (fallback) | Allotment, listing gains, gap-fill | Free scrape of `/report/…` (robots.txt allows it); rate-limit politely |

Each source is a `IpoSource` adapter implementing `List<IpoDto> fetchAll()`, so sources can be
added/removed without touching the merge, store, or notify layers.

---

## 4. Merge / precedence layer

- **Match key** (recognise the same IPO across sources): `normalize(company_name) + open_date`,
  where `normalize` = lowercase, strip `Ltd`/`Limited`/`Pvt`, collapse whitespace. Never rely
  on a source's internal id.
- **Field source-of-truth** (config, not hardcoded):
  ```
  dates, status, listing_exchange, listing_price   → NSE
  gmp, subscription                                → IPO Guru
  allotment, listing_gain, any field still null    → Chittorgarh
  ```
- **Conflicts:** keep the precedence winner; log the discarded value for debugging.
- **Quota spreading:** poll each source only for what it is best at (NSE ~daily for the
  authoritative list; IPO Guru a few times/day for GMP/subscription; Chittorgarh only to
  gap-fill) so every free limit is comfortably respected.

---

## 5. Freshness / "always updated"

- Track `last_polled_at` + `last_success_at` **per source** in `ipo_source_poll`.
- The site's **"Last updated HH:MM IST"** = most recent successful poll across sources.
- A failed poll never blanks the page — keep last-known values and retry with backoff (reuse
  the backoff pattern already used by the in-app updater).
- Crash-safe: reclaim any stuck `RUNNING` poll on startup (same fix pattern as TMDB sync).

---

## 6. Data model

```sql
-- Current merged state, one row per IPO
CREATE TABLE ipo_listing (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  match_key      VARCHAR(191) NOT NULL,          -- normalize(name)+open_date
  company_name   VARCHAR(255) NOT NULL,
  ipo_type       VARCHAR(16),                    -- mainboard | sme
  status         VARCHAR(16),                    -- upcoming|open|closed|allotment|listed
  open_date      DATE, close_date DATE,
  allotment_date DATE, listing_date DATE,
  price_min DECIMAL(10,2), price_max DECIMAL(10,2),
  lot_size INT, issue_size VARCHAR(64),
  -- listing venue & performance
  listing_exchange VARCHAR(16),                  -- NSE | BSE | BOTH
  listing_price    DECIMAL(10,2),
  listing_gain_pct DECIMAL(6,2),
  -- latest snapshots (full history in the tables below)
  gmp DECIMAL(10,2), gmp_pct DECIMAL(6,2),
  sub_total DECIMAL(10,2),
  -- allotment (list level)
  allotment_status VARCHAR(16),                  -- awaited | finalized | n/a
  registrar        VARCHAR(64),                  -- KFin | MUFG/Link Intime | Bigshare ...
  registrar_url    VARCHAR(255),                 -- deep link to that registrar's check page
  first_seen_at DATETIME, last_seen_at DATETIME, updated_at DATETIME,
  UNIQUE KEY uq_match_key (match_key)
);

-- GMP over time  →  powers the ₹/% chart
CREATE TABLE ipo_gmp_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ipo_id BIGINT NOT NULL,
  gmp DECIMAL(10,2), gmp_pct DECIMAL(6,2),
  source VARCHAR(32),
  captured_at DATETIME NOT NULL,
  KEY idx_ipo_time (ipo_id, captured_at)
);

-- Subscription build-up over time  →  optional second chart
CREATE TABLE ipo_subscription_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ipo_id BIGINT NOT NULL,
  qib DECIMAL(10,2), nii DECIMAL(10,2), retail DECIMAL(10,2), total DECIMAL(10,2),
  source VARCHAR(32),
  captured_at DATETIME NOT NULL,
  KEY idx_ipo_time (ipo_id, captured_at)
);

-- Change log (drives notifications + an audit feed)
CREATE TABLE ipo_change_event (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ipo_id BIGINT, event_type VARCHAR(32),         -- NEW|STATUS|GMP|SUBSCRIPTION|ALLOTMENT|LISTING
  old_value VARCHAR(255), new_value VARCHAR(255), created_at DATETIME
);

-- Per-source freshness / health
CREATE TABLE ipo_source_poll (
  source VARCHAR(32) PRIMARY KEY,
  last_polled_at DATETIME, last_success_at DATETIME,
  last_status VARCHAR(16), consecutive_failures INT DEFAULT 0
);

-- Applicant-level: a user's saved applications (see §7, Option A) — v2
CREATE TABLE ipo_user_application (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  ipo_id BIGINT NOT NULL,
  applicant_name VARCHAR(255),
  pan_last4 CHAR(4),               -- store MASKED only (see security note)
  application_no VARCHAR(64),
  dp_client_id VARCHAR(64),
  allotment_result VARCHAR(16),    -- unknown | allotted | not_allotted
  shares_allotted INT,
  checked_at DATETIME,
  created_at DATETIME,
  UNIQUE KEY uq_user_ipo (user_id, ipo_id)
);
```

> **Insert policy for history tables:** append a row only when the value **changed** vs the
> previous capture (dedupe consecutive equals). A step/line chart still renders perfectly and
> the tables stay small.

---

## 7. Allotment status — both levels

### 7a. List level (fully automatable) ✅
"Has allotment been finalized for this IPO?" → `ipo_listing.allotment_status` (`awaited` →
`finalized`) plus an `ALLOTMENT` change-event when it flips. Data comes from the normal
sources. Also store `registrar` + `registrar_url` per IPO.

### 7b. Applicant level ("did *I* get shares?") — v2

Checking an individual's result requires **PAN / application number / DP-Client ID + a CAPTCHA**
on the registrar or exchange page. It therefore **cannot be fully automated**.

- **Option A — Guided check (chosen, buildable).** A "**My IPOs**" feature: the user saves
  their application details per IPO (`ipo_user_application`). When allotment finalises, we
  notify them *"Allotment is out — check now"* with a **one-tap deep link** to the correct
  destination (registrar or BSE) with the IPO pre-selected. The user solves the CAPTCHA and
  reads the result; they may tap **"I got it / didn't"** to record `allotment_result` for their
  personal history. No CAPTCHA solving, no ToS risk.
- **Option B — Automated scrape of the allotment page (rejected).** Would need a CAPTCHA-solving
  service; unreliable and against site ToS. Documented as rejected.
- **To verify at build time:** whether any chosen data provider exposes an allotment-status-by-PAN
  API (uncommon). If one does, it becomes an enhancement to Option A.

**Check destinations to store / link:**
- **BSE:** `https://www.bseindia.com/investors/appli_check.aspx` (Equity → company → PAN/App no → CAPTCHA)
- **NSE:** NSE IPO bid/allotment page
- **Registrars:** KFin Technologies, MUFG / Link Intime, Bigshare, Skyline, Cameo — chosen from the IPO's `registrar` field.

> **Security note (PII):** PAN is sensitive personal data. **Do not store the full PAN** — keep
> only `pan_last4` + application number, which is enough to pre-fill a guided check. If full PAN
> must be stored, reuse the Document Wallet's AES-GCM encryption pattern (dedicated key), not
> plaintext.

---

## 8. GMP chart (₹ and % — both)

- Backed by `ipo_gmp_history`. Endpoint: `GET /api/ipos/{id}/gmp-history`
  → `[{ t, gmp, gmp_pct }, …]`.
- Render a **dual-axis line/step chart**: left Y = GMP in ₹ (absolute), right Y = GMP % (over
  issue price); shared X = time, spanning issue-open → listing. Provide a toggle to isolate
  either series. Follow the repo's `dataviz` conventions and `useT()` theming (works in AMOLED
  dark / white light).
- **Subscription chart (kept):** same pattern from `ipo_subscription_history`
  (`GET /api/ipos/{id}/subscription-history`) — a small multi-line chart (QIB / NII / Retail /
  Total) showing demand build-up. Optional second tab on the detail view.

---

## 9. Scheduler cadence

Reuse the `scheduler_job_config` pattern (DB-backed, live-editable, no restart — same as
`SchedulerJobConfigEntity` / the admin Scheduler page).

| Job | Cadence | Writes |
|---|---|---|
| Upcoming/list refresh | daily | `ipo_listing`, `ipo_change_event` |
| Subscription (while an IPO is *open*) | every few hrs; hourly on close day | `ipo_subscription_history` |
| GMP | 1–2×/day; hourly near listing | `ipo_gmp_history` |
| Allotment / listing watch | around those dates only | `ipo_change_event` |

---

## 10. Notifications — triggers × channels

**Trigger** = *when* to notify (an event caught by change-detection). **Channel** = *how/where*
it's delivered. One trigger may fan out to several channels. Both are **user-configurable**
notification preferences.

**Triggers**

| Trigger | Event | Note |
|---|---|---|
| 🆕 New IPO | `NEW` | An IPO appears in the list |
| 📅 Opens today / closes tomorrow | `STATUS`/date | Date-driven reminder |
| 💹 GMP threshold crossed | `GMP` | Only above a user-set ₹ or % threshold (avoids noise) |
| 📊 Subscription milestone | `SUBSCRIPTION` | e.g. total crosses 1× / 10× (optional) |
| ✅ Allotment finalized | `ALLOTMENT` | Includes "check yours" deep link (§7b) |
| 📈 Listed | `LISTING` | With listing exchange + gain % |

**Channels** (decided: push only — **no in-app toast**)

| Channel | Status in db-world |
|---|---|
| **Android push** | ✅ exists (push-notification stack) |
| **Web push** (browser) | ➕ **new infrastructure** — see note |
| ~~In-app toast (`notify.*`)~~ | ❌ excluded by decision |
| ~~Email~~ | ❌ not in scope |

**Default:** all triggers on; delivered to Android push + Web push. (The site still renders the
list and a "Last updated" stamp — that's the page, not a notification channel.)

> **Push delivery is net-new work (but free).** Confirmed in the codebase: the client has
> `@capacitor/push-notifications` (Android can register a token), but the **backend has no push
> sender** (no `firebase-admin`, no VAPID/web-push, no service worker) and the existing
> `UserNotificationEntity` is the *in-app* feed — which is **excluded** by decision.
> **Plan:** use **Firebase Cloud Messaging** — it's **free (Spark plan, no billing)** and sends
> to **both Android and Web** from one credential. Needs: `firebase-admin` backend sender, a
> `push_subscription`/`push_device` store keyed by user (Android device token + web token), a
> web **service worker** + FCM init, and token registration endpoints. Built as a **fast-follow
> after the tracker ships**.

---

## 11. UI & placement

**Placement (decided): a new top-level app** — same treatment as Wallet, Vault, Cinema, Games.
It registers as an entry in **`homeData.APPS`** and appears in the header **"Apps" dropdown**
(the mechanism the Document Wallet already uses), with its own route (e.g. `/ipo`). Plus a
dedicated **admin console page** to manage it.

- **User page:** list with status filter (upcoming / open / listed) → detail view (dates, price
  band, subscription, **GMP ₹/% chart**, listing venue + gain, **allotment status + registrar
  deep link**, "My IPOs" save-application) → global **"Last updated HH:MM IST"** stamp.
- **Admin page:** source health (`ipo_source_poll`), cadence config, manual re-poll trigger,
  change-event feed.
- **Frontend stack (adminv2 consistency rule):** TanStack Query, RHF + Zod (the save-application
  form), Zustand, MUI DataGrid (admin lists), Framer Motion, `useT()` theming — no mixing.

---

## 12. Gotchas

- Cross-source de-dup via the match key; two sources will name the same IPO differently.
- Idempotent polls (changed-only history inserts; hash/field compare on `ipo_listing`).
- Normalise everything to IST before diffing dates/times.
- 429 handling + backoff per source; never poll faster than the data actually moves.
- Registrars rebrand (Link Intime → MUFG) — keep the registrar→URL map in config, not code.
- CAPTCHA blocks full applicant-level automation → guided deep-link only.
- Never store full PAN in plaintext (§7 security note).

---

## 13. Decisions (locked 2026-07-23)

1. **Sources:** IPO Guru (primary) + NSE + Chittorgarh. IPO Guru API key **requested — pending**;
   integration can be stubbed against the documented JSON shape until the key arrives.
2. **Channels:** **Android push + Web push only** — no in-app toast, no email. Delivered via
   **FCM (free Spark plan)**; backend sender is net-new and built as a **fast-follow after the
   tracker** (see §10 note). Sequencing decided: tracker + charts + admin ship first.
3. **Applicant-level "My IPOs":** **Deferred to v2 (recommended).** v1 ships the full tracker —
   multi-source merge, GMP ₹/% + subscription charts, list-level allotment, and push
   notifications. v2 adds per-user saved applications + guided allotment deep-links (with the
   PII handling in §7). *Flag if you'd rather pull it into v1.*
4. **Placement:** a **new top-level app** in `homeData.APPS` (like Wallet/Vault/Cinema/Games) at
   `/ipo`, plus an **admin console page** to manage sources/cadence.

### Still to confirm at build time
- User creates a **free Firebase project** + service-account for FCM (no cost; prerequisite for the push fast-follow).
- Whether any data provider offers allotment-status-by-PAN (would enhance v2).
