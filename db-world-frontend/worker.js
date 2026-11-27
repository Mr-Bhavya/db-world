const API_ORIGIN = "https://api.db-world.in";
const SITE_ORIGIN = "https://db-world.in";

const SEARCH_BOT =
  /googlebot|google-inspectiontool|bingbot|adidxbot|duckduckbot|yandexbot|baiduspider|applebot|slurp|ia_archiver|petalbot/i;
const SOCIAL_BOT =
  /whatsapp|facebookexternalhit|facebot|twitterbot|slackbot|slack-imgproxy|telegrambot|linkedinbot|discordbot|redditbot|pinterest|skypeuripreview|vkshare|embedly|quora link preview|outbrain|nuzzel|bitlybot|tumblr|flipboard|bufferbot/i;

function seoPath(pathname) {
  if (pathname === "/") return "/api/seo/page/home";
  if (pathname === "/db-weather") return "/api/seo/page/weather";
  if (pathname === "/db-games") return "/api/seo/page/games";
  if (pathname === "/about") return "/api/seo/page/about";
  if (pathname === "/db-cinema/browse") return "/api/seo/browse";
  if (pathname === "/db-cinema/movie") return "/api/seo/movies";
  if (pathname === "/db-cinema/tv-shows") return "/api/seo/series";
  if (pathname === "/db-ipo") return "/api/seo/ipo";

  const record = pathname.match(
    /^\/db-cinema\/(movie|series)\/([0-9]+)(?:-[^/]*)?$/,
  );
  if (record) return `/api/seo/record/${record[1]}/${record[2]}`;

  const ipo = pathname.match(/^\/db-ipo\/([^/]+)$/);
  if (ipo) return `/api/seo/ipo/${encodeURIComponent(ipo[1])}`;

  return null;
}

function socialPath(pathname) {
  const record = pathname.match(
    /^\/db-cinema\/(movie|series)\/([0-9]+)(?:-[^/]*)?$/,
  );
  return record ? `/api/social/record/${record[1]}/${record[2]}` : null;
}

export function upstreamPath(request) {
  const url = new URL(request.url);

  if (url.hostname === "db-world.in" && url.pathname === "/sitemap.xml") {
    return "/sitemap.xml";
  }

  const userAgent = request.headers.get("user-agent") || "";
  if (SEARCH_BOT.test(userAgent)) return seoPath(url.pathname);
  if (SOCIAL_BOT.test(userAgent)) return socialPath(url.pathname);
  return null;
}

function permanentRedirect(url) {
  const target = new URL(SITE_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  return Response.redirect(target.toString(), 301);
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveUpstream(request, env, path) {
  const upstreamUrl = new URL(path, API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("Origin");
  headers.delete("Cookie");
  headers.delete("Authorization");

  try {
    const upstream = await fetch(upstreamUrl, {
      headers,
      method: "GET",
      redirect: "follow",
      cf: { cacheTtl: path === "/sitemap.xml" ? 3600 : 300 },
    });
    if (upstream.ok || upstream.status < 500) {
      return withSecurityHeaders(upstream);
    }
  } catch {
    // Preserve the normal static experience if the crawler renderer is unavailable.
  }

  return withSecurityHeaders(await env.ASSETS.fetch(request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      url.hostname === "www.db-world.in" &&
      url.pathname !== "/.well-known/assetlinks.json"
    ) {
      return permanentRedirect(url);
    }

    const legacy = url.pathname.match(/^\/db-world(?<rest>\/.*)?$/);
    if (legacy) {
      const destination = new URL(SITE_ORIGIN);
      destination.pathname = legacy.groups.rest || "/";
      destination.search = url.search;
      return Response.redirect(destination.toString(), 301);
    }

    const path = upstreamPath(request);
    if (path) return serveUpstream(request, env, path);

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
