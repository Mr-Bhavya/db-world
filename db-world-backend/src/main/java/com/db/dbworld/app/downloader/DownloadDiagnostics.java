package com.db.dbworld.app.downloader;

import java.util.List;
import java.util.regex.Pattern;

final class DownloadDiagnostics {
    private static final Pattern ANSI = Pattern.compile("\\x1b\\[[0-?]*[ -/]*[@-~]");
    private static final Pattern URL = Pattern.compile("(?i)(?:https?|socks[45]?|ftp)://[^\\s<>\"']+");
    private static final Pattern HEADERS = Pattern.compile("(?im)(?:proxy-authorization|authorization|set-cookie|cookie)\\s*:[^\\r\\n]*");
    private static final Pattern SECRETS = Pattern.compile("(?i)\\b([\\w-]*(?:token|cookie|secret|password|passwd|signature|session|api[_-]?key|license[_-]?key)[\\w-]*|sid|hsid|ssid|sapisid|apisid)\\s*[:=]\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s,;]+)");
    private static final Pattern COOKIE_OPTION = Pattern.compile("(?i)--cookies(?:-from-browser)?(?:=|\\s+)(?:\"[^\"]*\"|'[^']*'|\\S+)");
    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+");
    private static final Pattern BEARER = Pattern.compile("(?i)\\bBearer\\s+[A-Za-z0-9._~+/-]+=*");

    private DownloadDiagnostics() {}

    static String safeText(String value) {
        if (value == null || value.isBlank()) return "(no diagnostic output)";
        if (value.startsWith("#HttpOnly_") || value.matches("(?s).*\\t(?:TRUE|FALSE)\\t.*")) return "[cookie data redacted]";
        String safe = ANSI.matcher(value).replaceAll("");
        safe = HEADERS.matcher(safe).replaceAll("[credential header redacted]");
        safe = COOKIE_OPTION.matcher(safe).replaceAll("--cookies [redacted]");
        safe = URL.matcher(safe).replaceAll("[url redacted]");
        safe = SECRETS.matcher(safe).replaceAll("$1=[redacted]");
        safe = JWT.matcher(safe).replaceAll("[jwt redacted]");
        safe = BEARER.matcher(safe).replaceAll("Bearer [redacted]");
        safe = safe.replaceAll("[\\p{Cntrl}]+", " ");
        return safe.length() > 2000 ? safe.substring(0, 2000) + " [truncated]" : safe;
    }

    static String option(List<String> command, String name) {
        int position = command.lastIndexOf(name);
        return position >= 0 && position + 1 < command.size() ? safeText(command.get(position + 1)) : "default";
    }

    static String sourceHost(String value) {
        try {
            String host = java.net.URI.create(value == null ? "" : value.trim()).getHost();
            return host == null ? "invalid" : safeText(host);
        } catch (IllegalArgumentException exception) { return "invalid"; }
    }
}