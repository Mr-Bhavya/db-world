---
name: seo
description: Audit or improve search engine optimization for public web pages. Use for technical SEO, crawlability, indexing, metadata, structured data, sitemaps, content, Core Web Vitals, or AI search visibility.
argument-hint: "[audit|technical|content|schema|performance|ai-search] [page or URL]"
---

# SEO

Perform an evidence-based SEO review or implement a requested SEO improvement. This
project uses a React/Vite client in `db-world-frontend`; distinguish its initial
HTML from the browser-rendered page and from the deployed server's responses.

## Scope and safety

- Identify the requested pages and whether they are intended to be public and
  indexable. If that distinction is unclear, ask before changing indexing rules.
- Never expose private, authenticated, administrative, or user-specific content
  through sitemaps, metadata, structured data, or indexing changes.
- Use local files and existing tools first. Only inspect URLs the user supplies
  or that are clearly in scope; do not send private code, credentials, or data
  to external audit services.
- An audit is read-only unless the user also asks for fixes. Do not promise
  rankings, indexing, rich results, or AI citations.

## Workflow

1. Establish scope and identify public routes, rendering and deployment
   behavior. Use the project's code graph first for code exploration.
2. Select relevant checks rather than assuming every check applies:
   - **Technical:** HTTP status and redirect chains, robots.txt, robots meta and
     X-Robots-Tag, canonical URLs, sitemap coverage and internal links. Check
     response HTML and rendered output separately for client-rendered pages.
   - **Page content:** titles, descriptions, headings, meaningful links, image
     alternatives, language, and content uniqueness and usefulness. Treat length
     suggestions as guidance, not guaranteed ranking rules.
   - **Structured data:** parse JSON-LD, check relevant Schema.org properties
     against visible content, and consult current Google documentation before
     claiming eligibility for a specific rich result.
   - **Performance:** use existing measurements or tools where available. Report
     LCP, INP and CLS separately, distinguish lab from field data, and do not
     claim a Core Web Vitals assessment without sufficient field data.
   - **AI search:** assess whether public content is accessible, clear and
     attributable; distinguish observed facts from speculative citation advice.
3. Use current official guidance when a rule or eligibility requirement may
   have changed:
   - https://developers.google.com/search/docs/fundamentals/seo-starter-guide
   - https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
   - https://web.dev/articles/vitals
4. Report findings by priority with the affected route or file, observed
   evidence, impact, and a concrete recommendation. Separate unverified
   assumptions and blocked checks from confirmed issues.
5. If changes were requested, follow existing project patterns, add focused
   tests for changed behavior where appropriate, and verify relevant rendered
   output and build or test commands. Report any verification not performed.
