package com.db.dbworld.app.stream.service;

import com.db.dbworld.app.stream.enums.StreamType;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class CdnSignerTest {

    /**
     * Locks the output to what nginx's {@code secure_link_md5 "$secure_link_expires $uri <secret>"}
     * produces. Reference vector generated exactly as nginx computes it:
     * <pre>
     *   printf '%s' "1000000000 /id/abc123 my-shared-secret" \
     *     | openssl md5 -binary | openssl base64 | tr '+/' '-_' | tr -d '='
     * </pre>
     * If this test breaks, the signing format has drifted out of sync with nginx and every
     * signed CDN URL will 403.
     */
    @Test
    void hash_matchesNginxSecureLinkVector() {
        assertThat(CdnSigner.hash(1_000_000_000L, "/id/abc123", "my-shared-secret"))
                .isEqualTo("QGcGI_Xd5LilmCEyHJQX2A");
    }

    @Test
    void signatureSuffix_emptyWhenDisabled() {
        AppProperties props = Mockito.mock(AppProperties.class);
        when(props.isCdnSigningEnabled()).thenReturn(false);

        assertThat(new CdnSigner(props).signatureSuffix("/id/x", StreamType.ONLINE)).isEmpty();
    }

    @Test
    void signatureSuffix_emptyWhenSecretBlank() {
        AppProperties props = Mockito.mock(AppProperties.class);
        when(props.isCdnSigningEnabled()).thenReturn(true);
        when(props.getCdnSigningSecret()).thenReturn("   ");

        assertThat(new CdnSigner(props).signatureSuffix("/id/x", StreamType.ONLINE)).isEmpty();
    }

    @Test
    void signatureSuffix_appendsMd5AndExpires_withPerIntentTtl() {
        AppProperties props = Mockito.mock(AppProperties.class);
        when(props.isCdnSigningEnabled()).thenReturn(true);
        when(props.getCdnSigningSecret()).thenReturn("s3cr3t");
        when(props.getCdnStreamTtlSeconds()).thenReturn(3_600L);
        when(props.getCdnDownloadTtlSeconds()).thenReturn(7_200L);

        CdnSigner signer = new CdnSigner(props);
        String stream   = signer.signatureSuffix("/id/x", StreamType.ONLINE);
        String download = signer.signatureSuffix("/id/x", StreamType.DOWNLOAD);

        assertThat(stream).startsWith("&md5=").contains("&expires=");
        assertThat(download).startsWith("&md5=").contains("&expires=");
        // Download TTL (7200s) is longer than stream TTL (3600s) → download expires ~1h later.
        assertThat(expiresOf(download) - expiresOf(stream)).isBetween(3_400L, 3_800L);
    }

    private static long expiresOf(String suffix) {
        int i = suffix.indexOf("&expires=");
        return Long.parseLong(suffix.substring(i + "&expires=".length()));
    }
}
