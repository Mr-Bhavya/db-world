package com.db.dbworld.core.user.enums;

/**
 * Canonical gender values. The DB column stays a String (legacy rows hold mixed
 * casing like "male"/"MALE"), but every write is normalised through {@link #normalize}
 * so stored values converge on the title-case label ("Male"/"Female"/"Other") and
 * the edit form can match/pre-fill them reliably.
 */
public enum Gender {
    MALE("Male"),
    FEMALE("Female"),
    OTHER("Other");

    private final String label;

    Gender(String label) { this.label = label; }

    public String getLabel() { return label; }

    /**
     * Case-insensitively maps an enum name or label to its canonical label.
     * Blank → null; an unrecognised value is returned trimmed but untouched
     * (so we never silently drop odd legacy data).
     */
    public static String normalize(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        if (t.isEmpty()) return null;
        for (Gender g : values()) {
            if (g.name().equalsIgnoreCase(t) || g.label.equalsIgnoreCase(t)) return g.label;
        }
        return t;
    }
}
