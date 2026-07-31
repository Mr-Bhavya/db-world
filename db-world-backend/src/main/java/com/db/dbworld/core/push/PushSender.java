package com.db.dbworld.core.push;

import java.util.List;
import java.util.Map;

/**
 * Transport abstraction for outgoing push notifications. The default {@link LoggingPushSender} is a
 * no-op that only logs — it keeps the whole notification pipeline (device registration, IPO
 * lifecycle → message building, broadcast) fully working and testable without any external
 * credentials. An FCM-backed implementation (Firebase Admin / HTTP v1) is dropped in later, once a
 * Firebase service account is configured; nothing that depends on this interface changes.
 *
 * <p>Implementations must be defensive: never throw on a delivery failure (a push hiccup must never
 * break the poll or a user request), and no-op cleanly when unconfigured/disabled.
 */
public interface PushSender {

    /**
     * Broadcast a notification to every device subscribed to {@code topic}.
     *
     * @param data      optional key/value payload delivered alongside the notification (e.g. a
     *                  deep-link target); may be empty, never null.
     * @param channelId Android notification-channel id (e.g. {@code "ipo"}, {@code "cinema"},
     *                  {@code "admin"}, {@code "request-updates"}); when non-blank it is attached as
     *                  {@code android.notification.channel_id} so Android routes the notification to
     *                  the right channel. null/blank ⇒ no channel (device default).
     */
    void sendToTopic(String topic, String title, String body, Map<String, String> data, String channelId);

    /**
     * Deliver a notification directly to a set of device tokens (targeted push — not a topic
     * broadcast). One FCM message is sent per token; best-effort — a single token failing must not
     * abort the rest, and the whole call no-ops cleanly when unconfigured/disabled.
     *
     * @param channelId Android notification-channel id, same semantics as
     *                  {@link #sendToTopic(String, String, String, Map, String)}.
     */
    void sendToTokens(List<String> tokens, String title, String body, Map<String, String> data, String channelId);

    /** Subscribe device tokens to {@code topic} so a later {@link #sendToTopic} reaches them. */
    void subscribeToTopic(List<String> tokens, String topic);

    /**
     * Unsubscribe device tokens from {@code topic} so a later {@link #sendToTopic} no longer reaches
     * them (e.g. a demoted admin or a shared device that should stop receiving admin pushes).
     * Best-effort — never throws, no-ops when unconfigured/disabled.
     */
    void unsubscribeFromTopic(List<String> tokens, String topic);

    /** Whether a real transport is wired and ready to actually deliver (false for the no-op default). */
    default boolean isReady() {
        return false;
    }
}
