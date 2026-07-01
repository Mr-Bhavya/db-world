package com.db.dbworld.download;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Minimal JSON-RPC 2.0 client for the embedded aria2c process, spoken over HTTP to
 * {@code http://127.0.0.1:<port>/jsonrpc}. Every request carries the RPC secret as the
 * first parameter ({@code "token:<secret>"}), as aria2 requires when {@code --rpc-secret}
 * is set.
 *
 * All calls are synchronous and MUST be made off the main thread (the plugin invokes them
 * from its background executor / poller). Localhost round-trips are sub-millisecond, so the
 * short timeouts below are generous.
 *
 * See the aria2 RPC reference for method/field semantics:
 * https://aria2.github.io/manual/en/html/aria2c.html#methods
 */
final class Aria2Rpc {

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    /** Status keys fetched every poll tick — kept minimal to make 1 Hz polling cheap. */
    static final JSONArray POLL_KEYS = new JSONArray()
            .put("gid").put("status").put("totalLength").put("completedLength")
            .put("downloadSpeed").put("connections").put("errorCode").put("errorMessage");

    /** Full key set including the on-disk path + source URIs — used on completion/reconcile. */
    static final JSONArray FULL_KEYS = new JSONArray()
            .put("gid").put("status").put("totalLength").put("completedLength")
            .put("downloadSpeed").put("connections").put("errorCode").put("errorMessage")
            .put("dir").put("files");

    private final OkHttpClient client;
    private final String endpoint;
    private final String token;
    private final AtomicLong idSeq = new AtomicLong(0);

    Aria2Rpc(String host, int port, String secret) {
        this.endpoint = "http://" + host + ":" + port + "/jsonrpc";
        this.token = "token:" + (secret == null ? "" : secret);
        this.client = new OkHttpClient.Builder()
                .connectTimeout(3, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build();
    }

    // ─── core ──────────────────────────────────────────────────────────────────

    /**
     * Invokes {@code method} with the secret token prepended to {@code params}.
     * Returns the raw {@code result} (String / JSONObject / JSONArray) or throws.
     */
    @Nullable
    Object call(@NonNull String method, Object... params) throws IOException {
        JSONArray p = new JSONArray();
        p.put(token);
        for (Object o : params) p.put(o);

        String payload;
        try {
            payload = new JSONObject()
                    .put("jsonrpc", "2.0")
                    .put("id", String.valueOf(idSeq.incrementAndGet()))
                    .put("method", method)
                    .put("params", p)
                    .toString();
        } catch (JSONException e) {
            throw new IOException("failed to build RPC payload for " + method, e);
        }

        Request req = new Request.Builder()
                .url(endpoint)
                .post(RequestBody.create(JSON, payload)) // (MediaType, String) — stable across OkHttp 4.x
                .build();

        try (Response resp = client.newCall(req).execute()) {
            String bodyStr = resp.body() != null ? resp.body().string() : "";
            if (!resp.isSuccessful() && bodyStr.isEmpty()) {
                throw new IOException("aria2 RPC HTTP " + resp.code() + " for " + method);
            }
            JSONObject json = new JSONObject(bodyStr);
            if (json.has("error")) {
                throw new IOException("aria2 RPC error for " + method + ": " + json.get("error"));
            }
            return json.opt("result");
        } catch (JSONException e) {
            throw new IOException("failed to parse RPC response for " + method, e);
        }
    }

    // ─── lifecycle / health ─────────────────────────────────────────────────────

    /** Returns aria2's version string; used as a readiness probe. */
    String getVersion() throws IOException {
        Object r = call("aria2.getVersion");
        if (r instanceof JSONObject) return ((JSONObject) r).optString("version", "?");
        return String.valueOf(r);
    }

    JSONObject getGlobalStat() throws IOException {
        Object r = call("aria2.getGlobalStat");
        return (r instanceof JSONObject) ? (JSONObject) r : new JSONObject();
    }

    /** Persist the current session (active/waiting/paused) so it survives a process restart. */
    void saveSession() throws IOException {
        call("aria2.saveSession");
    }

    void changeGlobalOption(JSONObject options) throws IOException {
        call("aria2.changeGlobalOption", options);
    }

    // ─── enqueue ────────────────────────────────────────────────────────────────

    /**
     * Enqueues a URI. {@code options} may carry {@code out}, {@code dir}, {@code header}, etc.
     * Returns the new download's gid.
     */
    String addUri(String uri, @Nullable JSONObject options) throws IOException {
        JSONArray uris = new JSONArray().put(uri);
        Object r = (options != null) ? call("aria2.addUri", uris, options)
                                     : call("aria2.addUri", uris);
        return String.valueOf(r);
    }

    // ─── per-download control ─────────────────────────────────────────────────

    void pause(String gid)       throws IOException { call("aria2.pause", gid); }
    void forcePause(String gid)  throws IOException { call("aria2.forcePause", gid); }
    void unpause(String gid)     throws IOException { call("aria2.unpause", gid); }
    void remove(String gid)      throws IOException { call("aria2.remove", gid); }
    void forceRemove(String gid) throws IOException { call("aria2.forceRemove", gid); }

    /** Drops a completed/error/removed record from aria2's result list. */
    void removeDownloadResult(String gid) throws IOException { call("aria2.removeDownloadResult", gid); }

    void pauseAll()   throws IOException { call("aria2.pauseAll"); }
    void unpauseAll() throws IOException { call("aria2.unpauseAll"); }

    // ─── queries ────────────────────────────────────────────────────────────────

    JSONObject tellStatus(String gid, JSONArray keys) throws IOException {
        Object r = call("aria2.tellStatus", gid, keys);
        return (r instanceof JSONObject) ? (JSONObject) r : new JSONObject();
    }

    JSONArray tellActive(JSONArray keys) throws IOException {
        Object r = call("aria2.tellActive", keys);
        return (r instanceof JSONArray) ? (JSONArray) r : new JSONArray();
    }

    /** Waiting AND paused downloads (aria2 groups both under tellWaiting; distinguish by "status"). */
    JSONArray tellWaiting(int offset, int num, JSONArray keys) throws IOException {
        Object r = call("aria2.tellWaiting", offset, num, keys);
        return (r instanceof JSONArray) ? (JSONArray) r : new JSONArray();
    }

    JSONArray tellStopped(int offset, int num, JSONArray keys) throws IOException {
        Object r = call("aria2.tellStopped", offset, num, keys);
        return (r instanceof JSONArray) ? (JSONArray) r : new JSONArray();
    }
}
