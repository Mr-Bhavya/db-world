package com.db.dbworld.download;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Publishes a finished download into the public Downloads collection so it is
 * visible in the phone's Files app and other players, while remaining playable
 * in-app.
 *
 * On API 29+ this goes through MediaStore (no storage permission needed for our
 * own entries). On API ≤ 28 the plugin already writes straight to public
 * Downloads via a file path, so this class is only used on API 29+.
 */
final class MediaStorePublisher {

    static final String SUBDIR = "DB-World";

    private MediaStorePublisher() {}

    /**
     * Copies {@code src} into MediaStore Downloads/DB-World and returns the
     * resulting content URI. Caller is responsible for deleting {@code src}
     * afterwards (move semantics).
     */
    static Uri publish(Context ctx, File src, String displayName, String mimeType)
            throws IOException {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            throw new IllegalStateException("publish() is for API 29+ only");
        }

        ContentResolver resolver = ctx.getContentResolver();
        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, displayName);
        if (mimeType != null && !mimeType.isEmpty()) {
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        }
        values.put(MediaStore.Downloads.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/" + SUBDIR);
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri item = resolver.insert(collection, values);
        if (item == null) {
            throw new IOException("MediaStore insert returned null for " + displayName);
        }

        try (InputStream in = new FileInputStream(src);
             OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) throw new IOException("openOutputStream returned null");
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
            }
            out.flush();
        } catch (IOException e) {
            // Roll back the half-written pending entry so it doesn't linger.
            try { resolver.delete(item, null, null); } catch (Exception ignored) {}
            throw e;
        }

        values.clear();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        resolver.update(item, values, null, null);
        return item;
    }

    /**
     * Deletes a previously published file, whether it's a MediaStore content URI
     * (API 29+) or a plain file path/URI (API ≤ 28). Best-effort.
     */
    static void delete(Context ctx, String localUri) {
        if (localUri == null || localUri.isEmpty()) return;
        try {
            if (localUri.startsWith("content://")) {
                ctx.getContentResolver().delete(Uri.parse(localUri), null, null);
            } else {
                File f = new File(localUri.replace("file://", ""));
                if (f.exists()) //noinspection ResultOfMethodCallIgnored
                    f.delete();
            }
        } catch (Exception ignored) {
            // best-effort; the Fetch record is removed regardless
        }
    }
}
