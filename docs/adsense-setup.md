# AdSense setup for db-world.in

Publisher ID: `pub-8394425716692410` (already live in `public/ads.txt` and `index.html`).

Google moves labels around in the AdSense UI, so each step below says what you are
trying to accomplish as well as where it currently lives. If a label has moved, search
the AdSense help panel for the goal, not the button name.

---

## Step 0 — Find out what state the account is actually in

Nothing else on this page matters until this is answered. Sign in at
<https://adsense.google.com> and read the banner on the Home screen.

| What you see | What it means | What to do |
|---|---|---|
| "Your site isn't ready to show ads" / "We're getting your site ready" | Review never completed, or the crawler couldn't reach the content | Steps 1–4 |
| "Your account is not active" / prompted to finish setup | Signed up but never completed activation (payment address, site verification) | Steps 1, 6 |
| "Your AdSense account is disabled" | Either **inactivity** or a **policy action** — the banner says which | See below |
| Normal dashboard with reporting | Active. Skip to Step 5 | Steps 5, 7 |

**If it is disabled:**

- **For inactivity** — Google disables accounts that never served an ad or went a long
  time with no activity. This is normally recoverable: the notice carries an appeal or
  "request review" link. Appeal only once the site is genuinely ready to serve ads,
  because a second failed review is harder to come back from.
- **For a policy violation** — read the Policy Center entry carefully; it names the
  specific policy and usually the specific URL. Fix the cause first, then appeal. Do
  not appeal without changing anything.

> One caveat worth stating plainly, since it bears on this account: AdSense policy
> prohibits monetising content you do not hold the distribution rights to, and
> enforcement is at the **account** level rather than the page level. You have decided
> to run ads on the cinema pages, which is your call — but if a review is ever triggered,
> that is the most likely reason it goes badly, and it would take the whole publisher ID
> with it, not just those pages.

---

## Step 1 — Add and verify the site

**Sites → Add site → `db-world.in`** (bare domain, no `https://`, no `www`).

AdSense offers three verification methods. You already satisfy two of them:

- **AdSense code snippet** — the loader in `index.html`. Already present.
- **Meta tag** — `<meta name="google-adsense-account" content="ca-pub-8394425716692410">`
  in `index.html`. Already present.
- **ads.txt snippet** — `public/ads.txt`. Already present.

So pick whichever method it offers and click Verify. If verification fails, confirm the
files are actually reachable at the domain root — this is the one thing that is easy to
get wrong with a static nginx deploy:

```bash
curl -s https://db-world.in/ads.txt && curl -sI https://db-world.in/robots.txt | head -1
```

`ads.txt` must return the publisher line and `robots.txt` must return `200`. Both live
in `db-world-frontend/public/`, which Vite copies to the **root** of `dist/` — note that
is the domain root, alongside index.html.

---

## Step 2 — Confirm ads.txt is recognised

After verification, AdSense shows an ads.txt status on the Sites page. It can take a few
days to move to "Authorised". An unresolved ads.txt warning suppresses a large share of
ad revenue, so do not ignore it.

The file contains exactly one line, which is correct as-is:

```
google.com, pub-8394425716692410, DIRECT, f08c47fec0942fa0
```

---

## Step 3 — Satisfy the content requirements before requesting review

This is where most reviews fail, and it is where this one did.

### What the first review came back with (September 2026)

Two findings: **"Google-served ads on screens without publisher content"** and
**"Low value content"**. Both were accurate. What Google was actually served:

| URL, as Googlebot | Was | Real text |
|---|---|---|
| `/db-world` (hub) — **carried an ad** | 5 KB SPA shell | 0 words, title `DB World :)` |
| `/privacy`, `/terms`, `/contact` | 5 KB SPA shell | 0 words |
| `/db-games`, `/db-weather` | 5 KB SPA shell | 0 words |
| `/db-cinema/browse` — **carried an ad** | prerendered | 724 words: a list of film titles |
| `/db-ipo` — **carried an ad** | prerendered | 977 words: a list of company names |
| `/db-cinema/movie/{id}` × **2,335** | prerendered | TMDB synopsis + genres + cast, nothing else |

Three root causes, all now fixed:

1. **The hub carried an ad and was pure navigation** — a grid of tiles linking to
   sub-apps. The policy names navigation screens explicitly.
2. **`AdSlot` rendered unconditionally**, so a unit appeared over loading skeletons,
   over failed fetches, and on the IPO page's "No IPOs found" card.
3. **AdSense's own crawlers were being served the wrong document.**
   `mediapartners-google` and `adsbot-google` were in nginx's `$is_search_bot` map, so
   both were routed to `SeoRenderController` — a couple of kilobytes of metadata with
   **no ad units in it at all**. Google was asked to approve pages it had never seen.

### What has to be true before requesting a review again

- **Ads only render next to content.** `AdSlot` takes a `ready` prop that defaults to
  `false`; a call site that forgets it renders nothing. Do not remove that default.
- **Every ad-bearing page has copy of its own.** Home, weather, games and cinema browse
  each render an `EditorialSections` block from `site-content.json`. That file is the
  single source of truth and `SeoRenderController` renders it for crawlers too, so the
  two cannot drift.
- **Google's ad crawlers see the real page.** Keep `mediapartners-google` and
  `adsbot-google` OUT of `$is_search_bot` in `00-shared.conf`.
- **Record pages are `noindex,follow` and out of the sitemap.** They are TMDB metadata
  and were 89% of the submitted URLs. They still serve ads — indexing is not required
  for that.
- **Privacy, Terms, Contact and About** exist, are footer-linked from every page, and
  now serve real HTML rather than an empty shell.

### Verifying it before you submit

```bash
curl -sS -A "Mediapartners-Google" https://db-world.in/ | head -40
```

That must return the **real SPA**, not `/api/seo/...` output. And:

```bash
curl -sS -A "Googlebot/2.1" https://db-world.in/db-weather | grep -c "<h2>"
```

That must be greater than zero. Both need the nginx reload and the backend deploy to
have happened — the fix is in two repos.

The `/db-world` prefix was removed in September 2026, so also confirm the ~300 URLs
Google already holds still resolve rather than 404:

```bash
curl -sS -o /dev/null -w "%{http_code} -> %{redirect_url}
"   https://db-world.in/db-world/db-cinema/browse
```

That must be `301 -> https://db-world.in/db-cinema/browse`.

---

## Step 4 — Request the review

**Sites → db-world.in → Request review.** Then wait; it is usually a few days but can be
a couple of weeks. Do not resubmit while one is pending.

A re-review after a violation notice is requested from the same place, via **"I confirm
that I have fixed the issues"** on the policy notice itself. Only tick that once the
deploy is live and the two curl checks above pass — a re-review against the unfixed site
spends an attempt for nothing.

---

## Step 5 — Create the ad units

Only possible once the account is active.

**Ads → By ad unit → Display ads.** Create one per row below, and for each copy the
10-digit `data-ad-slot` value out of the generated snippet. Ignore the rest of the
snippet — `AdSlot` already handles the client id, the format and the `push()`.

| Create a unit named | Shape | Goes into env var |
|---|---|---|
| `home-hub-bottom` | Responsive / Horizontal | `VITE_AD_SLOT_HOME` |
| `cinema-browse-bottom` | Responsive / Square | `VITE_AD_SLOT_CINEMA_BROWSE` |
| `cinema-movies-bottom` | Responsive / Square | `VITE_AD_SLOT_CINEMA_MOVIES` |
| `cinema-series-bottom` | Responsive / Square | `VITE_AD_SLOT_CINEMA_SERIES` |
| `cinema-detail-below` | Responsive / Horizontal | `VITE_AD_SLOT_CINEMA_DETAIL` |
| `ipo-list-bottom` | Responsive / Horizontal | `VITE_AD_SLOT_IPO_LIST` |
| `ipo-detail-below` | Responsive / Horizontal | `VITE_AD_SLOT_IPO_DETAIL` |
| `weather-below-reference` | Responsive / Horizontal | `VITE_AD_SLOT_WEATHER` |
| `games-hub-bottom` | Responsive / Horizontal | `VITE_AD_SLOT_GAMES` |

> The env var names in this table were wrong until September 2026 — four of them carried
> `_TOP` / `_BELOW` suffixes that `adsConfig.js` has never read, so following the old
> table set variables that did nothing. The names above match the code.

Set them in `runtime/.env.production`, then rebuild. Any variable left empty makes that
slot render nothing at all, so a partial rollout is safe.

**There is deliberately no unit on:** the admin console, any individual game, the video
player, sign-in, or the wallet and vault. The admin console matters most — ads there
would mean you and your admins generating impressions on your own units every session,
which is self-serving traffic and the fastest way to lose the account permanently.

**Do not enable Auto ads.** They inject units wherever Google likes, including over the
player and between rail cards — exactly the placements that generate accidental clicks
and invalid-traffic strikes. Auto ads would also bypass `AdSlot`'s `ready` gate entirely
and put units straight back onto the empty screens this site was rejected for. Every
unit above is placed by hand, below real content.

---

## Step 6 — Payments

**Payments → Payments info.**

1. **Name and address** — must match your bank records exactly. Hard to change later.
2. **Tax info** — India: PAN, plus the tax forms AdSense prompts for. Ads can serve
   before this is done, but payment is withheld until it is.
3. **PIN verification** — at **$10** earned, Google posts a physical PIN to that address.
   Enter it within the deadline shown, or earnings are withheld.
4. **Payment method** — bank account for EFT. Add it before reaching the threshold.
5. **Payout threshold** — **$100**. Below that, the balance rolls over each month.

---

## Step 7 — Consent messaging (required for EU/UK traffic)

**Privacy & messaging → GDPR.** Create and publish a GDPR message; do the same under
**CCPA** if you get US traffic. Google's own consent tool is free and satisfies the
IAB TCF requirement.

Without a published GDPR message, EU traffic serves **non-personalised ads only**, at a
substantially lower rate — or nothing at all.

Choose "Do not consent" as a visible option rather than a consent wall; a wall depresses
engagement and, for a site at your traffic level, is not worth the trade.

---

## Step 8 — Connect Search Console and submit the sitemap

Not part of AdSense, but it is what gets you the traffic the ads depend on.

1. <https://search.google.com/search-console> → add property `db-world.in`.
2. Verify (DNS TXT via Cloudflare is easiest given you already run DNS there).
3. **Sitemaps → Add a new sitemap → `sitemap.xml`**.
4. Use **URL Inspection** on one record URL and one IPO URL, and check the rendered HTML
   Google reports. If it shows an empty shell, the crawler-rendering layer is not
   working and indexing will not happen — that check is the ground truth, not the
   sitemap being accepted.

The sitemap is live at `https://db-world.in/sitemap.xml` once the nginx block from
`SitemapController`'s javadoc is deployed to the config repo.

---

## Ongoing

- **Policy Center** (Ads → Policy center) is where violations appear. Check it monthly.
  Issues there are per-URL at first and escalate if unaddressed.
- **Never click your own ads**, and do not ask anyone else to. Invalid traffic is the
  most common cause of permanent account termination, and Google does not usually
  reverse it.
- Expect roughly **₹20–80 per 1,000 pageviews** on general Indian traffic and
  **₹80–250** on finance content. At 10k pageviews/month that is about ₹800–2,500.
  Reaching the $100 threshold takes real traffic, which takes months.
