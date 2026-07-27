package com.db.dbworld.core.push;

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

    private final GoogleCredentials credentials; // null ⇒ inactive
    private final String projectId;
    private final RestClient http = RestClient.create();
    private final Gson gson = new Gson();

    public FcmPushSender() {
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
    public void sendToTopic(String topic, String title, String body, Map<String, String> data) {
        if (!isReady()) {
            log.debug("[push:inactive] would broadcast to topic='{}' title='{}'", topic, title);
            return;
        }
        try {
            JsonObject notification = new JsonObject();
            notification.addProperty("title", title);
            notification.addProperty("body", body);

            JsonObject message = new JsonObject();
            message.addProperty("topic", topic);
            message.add("notification", notification);
            if (data != null && !data.isEmpty()) {
                JsonObject dataObj = new JsonObject();
                data.forEach(dataObj::addProperty);
                message.add("data", dataObj);
            }

            JsonObject payload = new JsonObject();
            payload.add("message", message);

            http.post()
                    .uri(String.format(SEND_URL, projectId))
                    .header("Authorization", "Bearer " + accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(gson.toJson(payload))
                    .retrieve()
                    .toBodilessEntity();
            log.info("FCM broadcast → topic '{}': {}", topic, title);
        } catch (Exception e) {
            log.warn("FCM broadcast to topic '{}' failed: {}", topic, e.toString());
        }
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

    /** Current OAuth2 access token, refreshed if expired (google-auth caches + refreshes for us). */
    private String accessToken() throws Exception {
        credentials.refreshIfExpired();
        return credentials.getAccessToken().getTokenValue();
    }
}
