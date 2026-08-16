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
}
