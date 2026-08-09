package com.db.dbworld.core.push;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * FCM-backed {@link PushSender} — the real transport. Mints an OAuth2 access token from the Firebase
 * service account (via {@code google-auth-library}) and calls the FCM HTTP v1 send API + the
 * Instance-ID topic-subscribe API directly over {@link RestClient}. Chosen over the heavyweight
 * {@code firebase-admin} SDK precisely to avoid dragging gRPC/Netty into a Spring Boot app.
 *
 * <p>{@code @Primary} so it supersedes {@link LoggingPushSender} wherever a {@link PushSender} is
 * injected. Activation is gated on the {@code FCM_SERVICE_ACCOUNT_FILE} env var pointing at a
 * readable service-account JSON (a SECRET — never a committed file): unset/unreadable ⇒ the sender
 * stays INACTIVE and every call is a logged no-op, so tests/CI and any un-provisioned environment
 * behave exactly like the no-op sender. Every send is best-effort — failures are logged, never
 * thrown (a push hiccup must never break the poll or a user request).
 */
@Component("fcmPushSender")
@Primary
@Log4j2
public class FcmPushSender implements PushSender {

    private static final String ENV_SERVICE_ACCOUNT = "FCM_SERVICE_ACCOUNT_FILE";
    private static final String FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
    private static final String SEND_URL = "https://fcm.googleapis.com/v1/projects/%s/messages:send";
    private static final String IID_BATCH_ADD_URL = "https://iid.googleapis.com/iid/v1:batchAdd";
    private static final String IID_BATCH_REMOVE_URL = "https://iid.googleapis.com/iid/v1:batchRemove";

    private final GoogleCredentials credentials; // null ⇒ inactive
    private final String projectId;
    private final RestClient http = RestClient.create();
    private final Gson gson = new Gson();
    private final SettingsService settings;

    public FcmPushSender(SettingsService settings) {
        this.settings = settings;
        GoogleCredentials creds = null;
        String project = null;
        String path = System.getenv(ENV_SERVICE_ACCOUNT);
        if (path != null && !path.isBlank() && Files.isReadable(Path.of(path.trim()))) {
            try (InputStream in = new FileInputStream(path.trim())) {
                ServiceAccountCredentials sa = ServiceAccountCredentials.fromStream(in);
                project = sa.getProjectId();
                creds = sa.createScoped(List.of(FCM_SCOPE));
                log.info("FCM push sender ACTIVE (projectId={})", project);
            } catch (Exception e) {
                log.warn("FCM service account at '{}' could not be loaded — push stays inactive: {}", path, e.toString());
            }
        } else {
            log.info("FCM push sender inactive — {} unset/unreadable; push notifications will no-op.", ENV_SERVICE_ACCOUNT);
        }
        this.credentials = creds;
        this.projectId = project;
    }

    @Override
    public boolean isReady() {
        return credentials != null;
    }

    @Override
    public void sendToTopic(String topic, String title, String body, Map<String, String> data, String channelId) {
        if (!isReady()) {
            log.debug("[push:inactive] would broadcast to topic='{}' channel='{}' title='{}'", topic, channelId, title);
            return;
        }
        sendMessage("topic", topic, title, body, data, channelId, "topic '" + topic + "'");
    }

    @Override
    public void sendToTokens(List<String> tokens, String title, String body, Map<String, String> data, String channelId) {
        if (!isReady() || tokens == null || tokens.isEmpty()) {
            return;
        }
        // One message per token — the FCM HTTP v1 send API targets a single token per call. Fully
        // best-effort: sendMessage swallows per-token failures so one bad token never aborts the rest.
        for (String token : tokens) {
            if (token == null || token.isBlank()) {
                continue;
            }
            sendMessage("token", token.trim(), title, body, data, channelId, "token");
        }
    }

    /**
     * Build + POST one FCM HTTP v1 message. {@code targetKey}/{@code targetValue} selects the
     * recipient ({@code "topic"}/{@code "token"}). Best-effort — every failure is logged, never
     * thrown, so a push hiccup can't break the caller.
     */
    private void sendMessage(String targetKey, String targetValue, String title, String body,
                             Map<String, String> data, String channelId, String targetLabel) {
        try {
            long ttlSeconds = settings.getLong(ConfigKeys.PUSH_TTL_SECONDS);
            JsonObject message = buildMessage(targetKey, targetValue, title, body, data, channelId,
                    ttlSeconds, Instant.now().getEpochSecond());

            JsonObject payload = new JsonObject();
            payload.add("message", message);

            http.post()
                    .uri(String.format(SEND_URL, projectId))
                    .header("Authorization", "Bearer " + accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(gson.toJson(payload))
                    .retrieve()
                    .toBodilessEntity();
            log.info("FCM send → {}: {}", targetLabel, title);
        } catch (Exception e) {
            log.warn("FCM send to {} failed: {}", targetLabel, e.toString());
        }
    }

    /**
     * Builds the FCM HTTP v1 {@code message} object. Package-private + static so the notification-
     * expiry wiring is unit-testable without a live FCM call. When {@code ttlSeconds > 0} it stamps a
     * matching time-to-live on all three platforms — Android {@code ttl}, APNs {@code apns-expiration}
     * (an absolute epoch second), WebPush {@code TTL} — so FCM drops a push it couldn't deliver within
     * that window instead of hoarding it for ~4 weeks and flooding a device when it next comes online.
     * {@code ttlSeconds <= 0} leaves every expiry field off (FCM's default retention).
     */
    static JsonObject buildMessage(String targetKey, String targetValue, String title, String body,
                                   Map<String, String> data, String channelId,
                                   long ttlSeconds, long nowEpochSeconds) {
        JsonObject notification = new JsonObject();
        notification.addProperty("title", title);
        notification.addProperty("body", body);

        JsonObject message = new JsonObject();
        message.addProperty(targetKey, targetValue);
        message.add("notification", notification);
        if (data != null && !data.isEmpty()) {
            JsonObject dataObj = new JsonObject();
            data.forEach(dataObj::addProperty);
            message.add("data", dataObj);
        }

        // Android block carries the channel id and/or the ttl — only attached when non-empty.
        JsonObject android = new JsonObject();
        if (channelId != null && !channelId.isBlank()) {
            JsonObject androidNotification = new JsonObject();
            androidNotification.addProperty("channel_id", channelId.trim());
            android.add("notification", androidNotification);
        }
        if (ttlSeconds > 0) {
            android.addProperty("ttl", ttlSeconds + "s");
        }
        if (!android.entrySet().isEmpty()) {
            message.add("android", android);
        }

        // Same expiry for iOS (APNs, absolute epoch second) and browser/PWA (WebPush, relative seconds).
        if (ttlSeconds > 0) {
            JsonObject apnsHeaders = new JsonObject();
            apnsHeaders.addProperty("apns-expiration", String.valueOf(nowEpochSeconds + ttlSeconds));
            JsonObject apns = new JsonObject();
            apns.add("headers", apnsHeaders);
            message.add("apns", apns);

            JsonObject webpushHeaders = new JsonObject();
            webpushHeaders.addProperty("TTL", String.valueOf(ttlSeconds));
            JsonObject webpush = new JsonObject();
            webpush.add("headers", webpushHeaders);
            message.add("webpush", webpush);
        }
        return message;
    }

    @Override
    public void subscribeToTopic(List<String> tokens, String topic) {
        if (!isReady() || tokens == null || tokens.isEmpty()) {
            return;
        }
        try {
            JsonArray registrationTokens = new JsonArray();
            tokens.forEach(registrationTokens::add);

            JsonObject payload = new JsonObject();
            payload.addProperty("to", "/topics/" + topic);
            payload.add("registration_tokens", registrationTokens);

            http.post()
                    .uri(IID_BATCH_ADD_URL)
                    .header("Authorization", "Bearer " + accessToken())
                    .header("access_token_auth", "true")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(gson.toJson(payload))
                    .retrieve()
                    .toBodilessEntity();
            log.debug("Subscribed {} token(s) to topic '{}'", tokens.size(), topic);
        } catch (Exception e) {
            log.warn("FCM topic-subscribe (topic '{}') failed: {}", topic, e.toString());
        }
    }

    @Override
    public void unsubscribeFromTopic(List<String> tokens, String topic) {
        if (!isReady() || tokens == null || tokens.isEmpty()) {
            return;
        }
        try {
            JsonArray registrationTokens = new JsonArray();
            tokens.forEach(registrationTokens::add);

            JsonObject payload = new JsonObject();
            payload.addProperty("to", "/topics/" + topic);
            payload.add("registration_tokens", registrationTokens);

            http.post()
                    .uri(IID_BATCH_REMOVE_URL)
                    .header("Authorization", "Bearer " + accessToken())
                    .header("access_token_auth", "true")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(gson.toJson(payload))
                    .retrieve()
                    .toBodilessEntity();
            log.debug("Unsubscribed {} token(s) from topic '{}'", tokens.size(), topic);
        } catch (Exception e) {
            log.warn("FCM topic-unsubscribe (topic '{}') failed: {}", topic, e.toString());
        }
    }

    /** Current OAuth2 access token, refreshed if expired (google-auth caches + refreshes for us). */
    private String accessToken() throws Exception {
        credentials.refreshIfExpired();
        return credentials.getAccessToken().getTokenValue();
    }
}
