# SEO crawler rendering — how it works and what to deploy

## The problem

`db-world.in` is nginx serving a built React SPA. A request returns a nearly empty
`index.html` plus JavaScript; the browser builds the page. A human sees the finished
page. Googlebot largely does not — it gets the shell.

So "the pages are public now" is necessary but not sufficient. Without this layer,
nothing gets indexed, no visitors arrive from search, and the ad units never earn
anything regardless of how they are placed.

## The approach

Search-engine User-Agents are routed to a Spring Boot endpoint that renders the same
content as real HTML. This is **dynamic rendering**, and it is deliberately kept
distinct from cloaking:

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
- CI runs on a self-hosted Pi; headless Chrome there is fragile.
- `db-world.in` is static nginx with Spring Boot on a separate host, so there is no
  render step in the serving path to hook into.

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

---

## What to deploy

### 1. nginx (db-world-config repo, `10-app.conf`)

Add a search-bot map next to the existing social-crawler map, and route matching
requests to the backend.

```nginx
map $http_user_agent $is_search_bot {
    default 0;
    "~*googlebot|bingbot|duckduckbot|yandexbot|baiduspider|applebot|slurp" 1;
}
```

Inside the `db-world.in` server block:

```nginx
# Record detail
location ~ ^/db-world/db-cinema/(movie|series)/([0-9]+) {
    if ($is_search_bot) {
        proxy_pass https://api.db-world.in/api/seo/record/$1/$2;
    }
    try_files $uri /index.html;
}

# IPO detail
location ~ ^/db-world/ipo/(.+)$ {
    if ($is_search_bot) {
        proxy_pass https://api.db-world.in/api/seo/ipo/$1;
    }
    try_files $uri /index.html;
}

# Landing pages
location = /db-world/db-cinema/browse {
    if ($is_search_bot) { proxy_pass https://api.db-world.in/api/seo/browse; }
    try_files $uri /index.html;
}
location = /db-world/db-cinema/movie {
    if ($is_search_bot) { proxy_pass https://api.db-world.in/api/seo/movies; }
    try_files $uri /index.html;
}
location = /db-world/db-cinema/tv-shows {
    if ($is_search_bot) { proxy_pass https://api.db-world.in/api/seo/series; }
    try_files $uri /index.html;
}
location = /db-world/ipo {
    if ($is_search_bot) { proxy_pass https://api.db-world.in/api/seo/ipo; }
    try_files $uri /index.html;
}

# Sitemap
location = /sitemap.xml {
    proxy_pass https://api.db-world.in/sitemap.xml;
    proxy_set_header Host api.db-world.in;
}
```

Note the record-detail regex requires a numeric id before the slug, which matches how
`recordNav.js` builds the URL (`123-inception`) and keeps the map from swallowing other
paths.

### 2. Verify after deploying

Fetch as a bot and confirm you get real HTML rather than the SPA shell:

```bash
curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" https://db-world.in/db-world/ipo | head -40
```

You should see `<h1>IPO Radar</h1>` and a list of `<a>` links. A normal `curl` with no
User-Agent should still return the SPA shell — that is the correct split.

Then check the sitemap resolves:

```bash
curl -s https://db-world.in/sitemap.xml | head -20
```

### 3. Search Console

The authoritative check is not "did the sitemap get accepted" but what Google actually
renders. Use **URL Inspection → Test live URL → View crawled page** on one record URL
and one IPO URL. If the rendered HTML is an empty shell, this layer is not working and
no amount of sitemap submission will fix it.
