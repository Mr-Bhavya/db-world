package com.db.dbworld.core.push;

import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Default {@link PushSender}: logs what WOULD be sent and delivers nothing. This is the active
 * transport until an FCM-backed sender is configured — it keeps the whole notification pipeline
 * (device registration, IPO lifecycle → message building, broadcast) working and testable with no
 * external credentials. When an {@code FcmPushSender} is added it should be annotated
 * {@code @Primary} (or this bean conditioned out) so injection stays unambiguous. Reports
 * {@link #isReady()} = false so callers/UX can tell push isn't live yet.
 */
@Component
@Log4j2
public class LoggingPushSender implements PushSender {

    @Override
    public void sendToTopic(String topic, String title, String body, Map<String, String> data, String channelId) {
        log.info("[push:noop] would broadcast to topic='{}' channel='{}' title='{}' body='{}' data={}",
                topic, channelId, title, body, data);
    }

    @Override
    public void sendToTokens(List<String> tokens, String title, String body, Map<String, String> data, String channelId) {
        log.info("[push:noop] would send to {} token(s) channel='{}' title='{}' body='{}' data={}",
                tokens == null ? 0 : tokens.size(), channelId, title, body, data);
    }

    @Override
    public void subscribeToTopic(List<String> tokens, String topic) {
        log.info("[push:noop] would subscribe {} token(s) to topic='{}'",
                tokens == null ? 0 : tokens.size(), topic);
    }

    @Override
    public void unsubscribeFromTopic(List<String> tokens, String topic) {
        log.info("[push:noop] would unsubscribe {} token(s) from topic='{}'",
                tokens == null ? 0 : tokens.size(), topic);
    }
}
