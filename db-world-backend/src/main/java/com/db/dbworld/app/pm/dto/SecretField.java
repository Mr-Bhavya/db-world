package com.db.dbworld.app.pm.dto;

import com.db.dbworld.core.exception.DbWorldException;
import org.springframework.http.HttpStatus;

/**
 * Which secret of an entry to reveal, as the client names it in {@code ?field=}: {@code password},
 * {@code pin}, {@code notes}, {@code custom:<fieldId>} or {@code history:<historyId>} (an earlier
 * password of the entry).
 */
public sealed interface SecretField {

    SecretField PASSWORD = new Password();
    SecretField PIN = new Pin();
    SecretField NOTES = new Notes();

    /** The name the client used: safe to log (ids only, never a value). */
    String spec();

    record Password() implements SecretField {
        @Override public String spec() { return "password"; }
    }

    record Pin() implements SecretField {
        @Override public String spec() { return "pin"; }
    }

    record Notes() implements SecretField {
        @Override public String spec() { return "notes"; }
    }

    record Custom(String fieldId) implements SecretField {
        @Override public String spec() { return "custom:" + fieldId; }
    }

    record History(String historyId) implements SecretField {
        @Override public String spec() { return "history:" + historyId; }
    }

    /** @throws DbWorldException 400 for anything that is not one of the five forms */
    static SecretField parse(String raw) {
        if (raw != null) {
            switch (raw) {
                case "password" -> { return PASSWORD; }
                case "pin" -> { return PIN; }
                case "notes" -> { return NOTES; }
                default -> {
                    String customId = idAfter(raw, "custom:");
                    if (customId != null) return new Custom(customId);
                    String historyId = idAfter(raw, "history:");
                    if (historyId != null) return new History(historyId);
                }
            }
        }
        throw new DbWorldException(HttpStatus.BAD_REQUEST,
                "Unknown field: use password, pin, notes, custom:<fieldId> or history:<historyId>");
    }

    private static String idAfter(String raw, String prefix) {
        if (!raw.startsWith(prefix)) return null;
        String id = raw.substring(prefix.length()).trim();
        return id.isEmpty() ? null : id;
    }
}
