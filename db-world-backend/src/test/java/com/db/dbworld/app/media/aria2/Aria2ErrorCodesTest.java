package com.db.dbworld.app.media.aria2;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class Aria2ErrorCodesTest {

    @Test
    void knownCodeWithoutMessage_isReadable() {
        assertEquals("Not enough disk space (aria2 error 9)", Aria2ErrorCodes.describe(9, null));
    }

    @Test
    void knownCodeKeepsAria2Detail() {
        assertEquals("Host name could not be resolved — Name or service not known",
                Aria2ErrorCodes.describe(19, "Name or service not known"));
    }

    @Test
    void nothingKnown_neverSaysNull() {
        assertEquals("Download failed (aria2 gave no reason)", Aria2ErrorCodes.describe(null, " "));
        assertEquals("Download failed (aria2 error 99)", Aria2ErrorCodes.describe(99, null));
        assertEquals("raw text", Aria2ErrorCodes.describe(99, "raw text"));
    }
}
