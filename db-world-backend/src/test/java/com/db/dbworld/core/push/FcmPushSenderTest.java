package com.db.dbworld.core.push;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the FCM message-JSON builder — specifically the notification-expiry (TTL) wiring, which is
 * what stops a device that was offline for days from getting a flood of stale pushes on reconnect.
 * {@code buildMessage} is static + pure, so this needs no live FCM transport.
 */
class FcmPushSenderTest {

    @Test
    void buildMessage_withTtl_stampsExpiryOnAndroidApnsAndWebpush() {
        JsonObject msg = FcmPushSender.buildMessage(
                "topic", "ipo-all", "Title", "Body", Map.of("k", "v"), "ipo", 3600L, 1_000_000L);

        assertThat(msg.get("topic").getAsString()).isEqualTo("ipo-all");
        assertThat(msg.getAsJsonObject("data").get("k").getAsString()).isEqualTo("v");

        JsonObject android = msg.getAsJsonObject("android");
        assertThat(android.get("ttl").getAsString()).isEqualTo("3600s");
        assertThat(android.getAsJsonObject("notification").get("channel_id").getAsString()).isEqualTo("ipo");

        // APNs expiry is an absolute epoch second = now + ttl.
        assertThat(msg.getAsJsonObject("apns").getAsJsonObject("headers").get("apns-expiration").getAsString())
                .isEqualTo("1003600");
        // WebPush TTL is relative seconds.
        assertThat(msg.getAsJsonObject("webpush").getAsJsonObject("headers").get("TTL").getAsString())
                .isEqualTo("3600");
    }

    @Test
    void buildMessage_ttlZero_omitsAllExpiryFields() {
        JsonObject msg = FcmPushSender.buildMessage(
                "token", "abc123", "Title", "Body", Map.of(), "ipo", 0L, 1_000_000L);

        assertThat(msg.has("apns")).isFalse();
        assertThat(msg.has("webpush")).isFalse();
        // Android block is still present for the channel id, but carries no ttl.
        assertThat(msg.getAsJsonObject("android").has("ttl")).isFalse();
        assertThat(msg.getAsJsonObject("android").getAsJsonObject("notification").get("channel_id").getAsString())
                .isEqualTo("ipo");
    }

    @Test
    void buildMessage_noChannelNoTtl_hasNoAndroidOrDataBlock() {
        JsonObject msg = FcmPushSender.buildMessage(
                "topic", "ipo-all", "Title", "Body", null, null, 0L, 1L);

        assertThat(msg.has("android")).isFalse();
        assertThat(msg.has("data")).isFalse();
        assertThat(msg.getAsJsonObject("notification").get("title").getAsString()).isEqualTo("Title");
    }

    // ── Collapse: stop repeat alerts stacking up in the tray ────────────────────────────────────

    @Test
    void buildMessage_alertAboutOneEntity_collapsesOnKindAndEntity() {
        // Seven "GMP moved" pushes half a second apart became seven separate heads-up
        // notifications. Keyed on kind+entity, the newest state of a story REPLACES the previous
        // one instead of piling on top of it.
        JsonObject msg = FcmPushSender.buildMessage("topic", "ipo-all", "Title", "Body",
                Map.of("kind", "GMP_JUMP", "ipoId", "ipo-42"), "ipo-gmp", 3600L, 1_000_000L);

        JsonObject android = msg.getAsJsonObject("android");
        assertThat(android.get("collapse_key").getAsString()).isEqualTo("GMP_JUMP:ipo-42");
        assertThat(android.getAsJsonObject("notification").get("tag").getAsString())
                .isEqualTo("GMP_JUMP:ipo-42");
        assertThat(msg.getAsJsonObject("apns").getAsJsonObject("headers")
                .get("apns-collapse-id").getAsString()).isEqualTo("GMP_JUMP:ipo-42");
    }

    @Test
    void buildMessage_digestWithNoEntity_collapsesOnKindAlone() {
        // A digest names no single IPO, so it supersedes the previous digest OF THAT KIND.
        JsonObject msg = FcmPushSender.buildMessage("topic", "ipo-all", "Title", "Body",
                Map.of("kind", "OPENED", "count", "5"), "ipo", 0L, 1L);

        assertThat(msg.getAsJsonObject("android").get("collapse_key").getAsString()).isEqualTo("OPENED");
    }

    @Test
    void buildMessage_payloadWithNoKind_doesNotCollapse() {
        // A one-off message with no successor must keep FCM's default (never collapse), or an
        // unrelated push could silently replace it.
        JsonObject msg = FcmPushSender.buildMessage("topic", "ipo-all", "Title", "Body",
                Map.of("link", "/db-world/db-ipo"), "ipo", 0L, 1L);

        assertThat(msg.getAsJsonObject("android").has("collapse_key")).isFalse();
        assertThat(msg.has("apns")).isFalse();
    }

    @Test
    void collapseKey_overlongEntityId_truncatedToApnsLimit() {
        // apns-collapse-id is capped at 64 bytes; a longer one would make APNs reject the push.
        String key = FcmPushSender.collapseKey(Map.of("kind", "GMP_JUMP", "ipoId", "x".repeat(200)));

        assertThat(key).hasSize(64);
    }

    @Test
    void collapseKey_nullOrBlankKind_isNull() {
        assertThat(FcmPushSender.collapseKey(null)).isNull();
        assertThat(FcmPushSender.collapseKey(Map.of())).isNull();
        assertThat(FcmPushSender.collapseKey(Map.of("kind", " "))).isNull();
    }
}
