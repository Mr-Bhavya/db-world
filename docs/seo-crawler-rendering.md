# SEO crawler rendering — how it works and what to deploy

## The problem

`db-world.in` is served by a Cloudflare Worker with Vite static assets. A normal
request receives `index.html` plus JavaScript; the browser builds the page. Search
engines need the same public content before that JavaScript runs.

So "the pages are public now" is necessary but not sufficient. Without this layer,
nothing gets indexed, no visitors arrive from search, and the ad units never earn
anything regardless of how they are placed.

## The approach

The Worker recognizes search-engine User-Agents and routes them to a Spring Boot
endpoint that renders the same content as real HTML. This is **dynamic rendering**,
and it is deliberately kept distinct from cloaking:

> Cloaking is showing the crawler *materially different* content from the visitor.
> Everything `SeoRenderController` emits — title, year, rating, synopsis, genres, cast
> — is what the SPA paints on that same URL once its JavaScript runs. The crawler gets
> the same content *earlier*, not different content.

**If the SPA stops showing something, stop emitting it here too.** That rule is what
keeps this on the right side of the line.

### Why not build-time prerendering

It was the first instinct and it is the wrong fit here:

- The catalog gains records between deploys, and IPO data moves several times a day —
  baked HTML would ship stale, which is fatal for pages whose value is freshness.
- CI does not run a browser, and headless Chrome on every deploy would be brittle.
- The live Cloudflare asset worker can proxy the small backend-rendered surface
  while leaving ordinary visitors on the fast static build.

The social-preview plumbing already existed and already worked, so extending that
pattern was both cheaper and more correct.

### Why a separate controller from `SocialPreviewController`

`/api/social/**` serves social cards: `<head>`-only plus a meta refresh, which is right
for WhatsApp and Twitter. For a search crawler that same shape is close to worst-case —
a body-less document behind what reads as a redirect.

So the two are kept apart:

| Endpoint | Audience | Shape |
|---|---|---|
| `/api/social/**` | WhatsApp, Twitter, Slack | `<head>` OG tags + meta refresh |
| `/api/seo/**` | Googlebot, Bingbot, etc. | Full `<body>` + JSON-LD + canonical, **no** meta refresh |

`SeoRenderControllerTest` asserts the absence of the meta refresh explicitly — if that
test ever fails, indexing is silently broken.

## Endpoints

| Path | Renders |
|---|---|
| `/api/seo/record/{type}/{id}` | Record detail — heading, facts, synopsis, genres, cast, `Movie`/`TVSeries` JSON-LD |
| `/api/seo/ipo/{id}` | IPO detail — status, dates, price band, lot size, GMP, registrar, about |
| `/api/seo/browse`, `/movies`, `/series` | Link hubs listing up to 200 titles |
| `/api/seo/ipo` | Link hub listing IPOs |

The hubs matter as much as the detail pages: the sitemap tells Google the URLs exist,
but following links is how ranking signal actually reaches a detail page.

`DRAFT` records return **404**, never a generic placeholder — telling Google an
unpublished id is a real URL gets it indexed as soft-404 filler.

## Which cinema pages should be indexed?

The public **landing pages** remain indexable:

- `/db-cinema/browse`
- `/db-cinema/movie`
- `/db-cinema/tv-shows`
- genre/collection pages

Individual `/db-cinema/movie/{id}` and `/db-cinema/series/{id}` pages are
`noindex,follow` by default:

- most of their prose and facts are third-party TMDB metadata;
- the sitemap deliberately omits them;
- `follow` still lets discovery signals and users reach linked landing pages;
- they can be shared and show ads without asking Google to rank thousands of
  near-duplicated metadata pages.

An admin can add an original "DB World take" to a title in the record editor.
Once a PUBLISHED record contains at least 300 non-whitespace characters of
first-party copy, its server-rendered page becomes `index,follow` and its canonical
URL is added to the live sitemap automatically. UNLISTED, DRAFT, empty and short-note
pages remain unsubmitted and noindex.

Good editorial copy explains why the title stands out, who it suits, production or
theme context, pacing/tone expectations, and spoiler-light viewing guidance. Do not
paste TMDB synopses, other reviews, AI-generated filler, or repeated generic text:
the eligibility threshold is a technical floor, not evidence that the copy is useful.

Do not put a blanket `noindex` on `/db-cinema/**`. That would also hide the
first-party browse and editorial pages. `X-Robots-Tag` or `<meta name="robots">`
belongs only on detail pages unless those pages gain substantial original content.

## Which IPO detail pages should be indexed?

IPO landing pages remain indexable. Individual IPO details are `noindex,follow`
until a DB World AI analysis passes the same 300 non-whitespace-character floor
and the page visibly discloses that the analysis is general information, not
investment advice.

The IPO sitemap now contains only IPOs with saved AI analysis. Bare factual IPO
pages remain crawlable for links and direct access but do not enter the submitted
URL set. Analysis is recomputed gradually by the **IPO AI Analysis** scheduler job
and is based only on tracked issue facts, fundamentals, strengths/risks, GMP and
subscription values.

The labels APPLY / CONSIDER / WAIT are evidence summaries, not guaranteed return
predictions. The public page must always state that GMP is unofficial and that the
reader must review the RHP/DRHP and personal risk profile independently.

---

## What to deploy

### 1. Cloudflare Worker

Production routing lives in `db-world-frontend/worker.js` and
`db-world-frontend/wrangler.jsonc`. The Worker handles:

- canonical `www` and legacy-prefix 301 redirects;
- live `/sitemap.xml` proxying;
- search-engine routing to `/api/seo/**`;
- social-preview routing to `/api/social/**`;
- static assets and SPA fallback;
- Android App Links verification from `public/.well-known/assetlinks.json`.

Deploy through `.github/workflows/deploy.yml` with **Frontend** enabled. No nginx
reload is required for Worker changes.

The nginx files in `db-world-config` are retained as an origin fallback only. Keep
their crawler lists aligned with the Worker, but do not expect a Pi nginx reload to
change Cloudflare-hosted production traffic.

### 2. Verify after deploying

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://db-world.in/sitemap.xml
curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
  https://www.db-world.in/
curl -sS https://db-world.in/.well-known/assetlinks.json
```

The first request must be `200 application/xml`, the second a 301 to the apex, and
the third must return `application/json`.

The two crawler classes remain deliberately separate. `googlebot`, Applebot and the
other search engines receive full SEO documents. Ad-review crawlers such as
`Mediapartners-Google` and `AdsBot-Google` receive the normal SPA because they must
evaluate the real page and actual ad placement.

The legacy nginx fallback has corresponding `$is_search_bot` routing. Any bot added
to the Worker must also be considered for `00-shared.conf` so direct-origin tests do
not disagree with production.

### 3. Verify rendered content

Fetch as a bot and confirm you get real HTML rather than the SPA shell:

```bash
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" https://db-world.in/db-ipo | head -40
```

You should see `<h1>IPO Radar</h1>` and a list of `<a>` links. A normal `curl` with no
User-Agent should still return the SPA shell — that is the correct split.

### 4. Search Console

The authoritative check is not "did the sitemap get accepted" but what Google actually
renders. Use **URL Inspection → Test live URL → View crawled page** on one record URL
and one IPO URL. If the rendered HTML is an empty shell, this layer is not working and
no amount of sitemap submission will fix it.
