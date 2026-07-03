package com.db.dbworld.download;

import android.util.Log;

import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Durable per-download metadata that aria2 itself does not keep: display title, thumbnail,
 * mediaFileId/recordId (for deep-linking), mime type, and the published {@code localUri} of a
 * finished file. It is also the source of truth for COMPLETED downloads, which aria2 forgets on
 * restart (its session only persists unfinished transfers).
 *
 * Keyed by aria2 gid. A secondary lookup by on-disk {@code path} lets us re-map metadata to a
 * new gid if aria2 reissues gids when reloading its session — so history survives a process kill
 * either way. Backed by a single JSON file, rewritten atomically on every mutation; the expected
 * scale (tens of downloads) makes this simpler and sturdier than a database.
 */
final class DownloadMetaStore {

    private static final String TAG = "DbWorldDownload";

    private final File file;
    private final Map<String, JSONObject> byGid = new LinkedHashMap<>(); // insertion order

    DownloadMetaStore(File file) {
        this.file = file;
        load();
    }

    // ─── reads ──────────────────────────────────────────────────────────────────

    @Nullable
    synchronized JSONObject get(String gid) {
        JSONObject o = byGid.get(gid);
        return o == null ? null : copy(o);
    }

    /** All entries, newest first (by addedAt). Returns copies — mutate via patch/upsert. */
    synchronized List<JSONObject> all() {
        List<JSONObject> out = new ArrayList<>(byGid.size());
        for (JSONObject o : byGid.values()) out.add(copy(o));
        java.util.Collections.sort(out, (a, b) -> Long.compare(b.optLong("addedAt", 0), a.optLong("addedAt", 0)));
        return out;
    }

    /** Finds an entry by its file name (used for start-time de-duplication). */
    @Nullable
    synchronized JSONObject findByFileName(String fileName) {
        if (fileName == null) return null;
        for (JSONObject o : byGid.values()) {
            if (fileName.equals(o.optString("fileName", null))) return copy(o);
        }
        return null;
    }

    /** Returns the gid whose stored path matches, or null (used to reconcile after a reload). */
    @Nullable
    synchronized String gidForPath(String path) {
        if (path == null || path.isEmpty()) return null;
        for (Map.Entry<String, JSONObject> e : byGid.entrySet()) {
            if (path.equals(e.getValue().optString("path", null))) return e.getKey();
        }
        return null;
    }

    // ─── writes ─────────────────────────────────────────────────────────────────

    /** Insert or replace the whole entry for {@code gid}. */
    synchronized void upsert(String gid, JSONObject meta) {
        if (gid == null || meta == null) return;
        try { meta.put("gid", gid); } catch (Exception ignored) {}
        byGid.put(gid, meta);
        save();
    }

    /** Merge {@code fields} into an existing entry (no-op if unknown gid). */
    synchronized void patch(String gid, Map<String, Object> fields) {
        JSONObject o = byGid.get(gid);
        if (o == null) return;
        try {
            for (Map.Entry<String, Object> e : fields.entrySet()) o.put(e.getKey(), e.getValue());
        } catch (Exception ignored) {}
        save();
    }

    synchronized void remove(String gid) {
        if (byGid.remove(gid) != null) save();
    }

    /** Move an entry from an old gid to a new one, preserving order as best we can. */
    synchronized void rekey(String oldGid, String newGid) {
        if (oldGid == null || newGid == null || oldGid.equals(newGid)) return;
        JSONObject o = byGid.remove(oldGid);
        if (o == null) return;
        try { o.put("gid", newGid); } catch (Exception ignored) {}
        byGid.put(newGid, o);
        save();
    }

    // ─── persistence ─────────────────────────────────────────────────────────────

    private void load() {
        if (!file.exists()) return;
        try {
            byte[] buf = new byte[(int) file.length()];
            try (java.io.FileInputStream in = new java.io.FileInputStream(file)) {
                int off = 0, n;
                while (off < buf.length && (n = in.read(buf, off, buf.length - off)) != -1) off += n;
            }
            JSONArray arr = new JSONArray(new String(buf, StandardCharsets.UTF_8));
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                String gid = o.optString("gid", null);
                if (gid != null && !gid.isEmpty()) byGid.put(gid, o);
            }
        } catch (Exception e) {
            Log.w(TAG, "meta store load failed (starting empty): " + e.getMessage());
        }
    }

    /** Atomic rewrite: write a temp file, then rename over the target. */
    private void save() {
        JSONArray arr = new JSONArray();
        for (JSONObject o : byGid.values()) arr.put(o);
        File tmp = new File(file.getParentFile(), file.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(arr.toString().getBytes(StandardCharsets.UTF_8));
            out.flush();
            out.getFD().sync();
        } catch (IOException e) {
            Log.w(TAG, "meta store save failed: " + e.getMessage());
            return;
        }
        if (!tmp.renameTo(file)) {
            // renameTo can fail if the target exists on some filesystems — fall back to copy.
            //noinspection ResultOfMethodCallIgnored
            file.delete();
            if (!tmp.renameTo(file)) Log.w(TAG, "meta store rename failed");
        }
    }

    private static JSONObject copy(JSONObject o) {
        try {
            JSONObject c = new JSONObject();
            for (Iterator<String> it = o.keys(); it.hasNext(); ) {
                String k = it.next();
                c.put(k, o.get(k));
            }
            return c;
        } catch (Exception e) {
            return new JSONObject();
        }
    }
}
