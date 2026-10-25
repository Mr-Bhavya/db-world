package com.db.dbworld.app.pm.util;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.CustomFieldDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

/**
 * A fingerprint of a user's offline snapshot: it changes exactly when the snapshot's content does
 * (any entry added, edited, trashed, restored or purged, any secret changed). The installed Android
 * app keeps it beside its offline copy and downloads the full snapshot again only when the server's
 * fingerprint differs, instead of on every vault load.
 *
 * <p>An HMAC over the content, keyed with random bytes made when the process starts and never stored
 * or sent anywhere. Keyed, because the content includes the secrets: a plain hash would let anyone
 * holding a fingerprint test guesses against it. The price of a per-process key is that every
 * fingerprint changes on a restart, so each device downloads its snapshot once after a deploy.
 */
public final class SnapshotVersion {

    private static final byte[] KEY = new byte[32];
    static {
        new SecureRandom().nextBytes(KEY);
    }

    private SnapshotVersion() {
    }

    /** The fingerprint of the snapshot made of these groups (the payload of GET /api/pm/snapshot). */
    public static String of(List<PasswordManagerDto> groups) {
        Writer out = new Writer();
        // By id: the order the repository returns them in carries no meaning and must not change the
        // fingerprint. Custom fields keep theirs: their order is what the entry shows.
        groups.stream().sorted(Comparator.comparing(PasswordManagerDto::getId, Comparator.nullsFirst(Comparator.naturalOrder())))
                .forEach(g -> {
                    out.field("group").field(g.getId()).field(g.getHost() == null ? null : g.getHost().getName());
                    g.getCredentials().stream()
                            .sorted(Comparator.comparing(CredentialDto::getId, Comparator.nullsFirst(Comparator.naturalOrder())))
                            .forEach(c -> {
                                out.field("entry").field(c.getId()).field(c.getName())
                                        .field(Objects.toString(c.getType(), null)).field(c.getUrl())
                                        .field(c.getUsername()).field(c.getPassword()).field(c.getPin()).field(c.getNotes());
                                for (CustomFieldDto f : c.getCustomFields() == null ? List.<CustomFieldDto>of() : c.getCustomFields()) {
                                    out.field("custom").field(f.getId()).field(f.getFieldKey())
                                            .field(Objects.toString(f.getFieldType(), null)).field(f.getFieldValue());
                                }
                            });
                });
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(KEY, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(out.bytes()));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 is not available", e);
        }
    }

    /** Length-prefixed values, so no two different snapshots can run together into the same bytes. */
    private static final class Writer {
        private final ByteArrayOutputStream buf = new ByteArrayOutputStream();

        Writer field(String value) {
            if (value == null) {
                writeInt(-1);
            } else {
                byte[] b = value.getBytes(StandardCharsets.UTF_8);
                writeInt(b.length);
                buf.writeBytes(b);
            }
            return this;
        }

        private void writeInt(int v) {
            buf.write(v >>> 24);
            buf.write(v >>> 16);
            buf.write(v >>> 8);
            buf.write(v);
        }

        byte[] bytes() {
            return buf.toByteArray();
        }
    }
}
