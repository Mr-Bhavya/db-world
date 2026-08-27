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
is the domain root, not under `/db-world/`.

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

This is where most reviews fail. AdSense wants a site that looks like a real
publication, not an app shell:

- **Privacy Policy, Terms and Contact pages** — required. These are being added in this
  branch at `/db-world/privacy`, `/db-world/terms` and `/db-world/contact`, linked from
  the footer on every page.
- **Crawlable content.** The reviewer follows Googlebot. Until the crawler-rendering
  work lands, a bot fetching a record page still receives an empty SPA shell. **Request
  the review after that ships, not before.**
- **Navigation** — a visitor must be able to reach content from the home page without an
  account. That is what the public-browse change does.

---

## Step 4 — Request the review

**Sites → db-world.in → Request review.** Then wait; it is usually a few days but can be
a couple of weeks. Do not resubmit while one is pending.

---

## Step 5 — Create the four ad units

Only possible once the account is active.

**Ads → By ad unit → Display ads.** Create four, and for each one copy the 10-digit
`data-ad-slot` value from the generated snippet. Ignore the rest of the snippet — the
code already handles it.

| Create a unit named | Shape | Goes into env var |
|---|---|---|
| `cinema-browse-bottom` | Responsive / Square | `VITE_AD_SLOT_CINEMA_BROWSE_TOP` |
| `cinema-detail-below` | Responsive / Horizontal | `VITE_AD_SLOT_CINEMA_DETAIL_BELOW` |
| `ipo-list-bottom` | Responsive / Horizontal | `VITE_AD_SLOT_IPO_LIST_TOP` |
| `ipo-detail-below` | Responsive / Horizontal | `VITE_AD_SLOT_IPO_DETAIL_BELOW` |

Set those four variables in `runtime/.env.production`, then rebuild. Any variable left
empty makes that slot render nothing at all, so a partial rollout is safe.

**Do not enable Auto ads.** They inject units wherever Google likes, including over the
player and between rail cards — exactly the placements that generate accidental clicks
and invalid-traffic strikes. The four manual units above are placed deliberately below
real content.

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
