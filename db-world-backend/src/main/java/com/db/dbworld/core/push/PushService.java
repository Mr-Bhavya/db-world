package com.db.dbworld.core.push;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Device-token registration + broadcast entry point for push notifications. Registration upserts a
 * device's FCM token (unique) and subscribes it to the broadcast topic; broadcasting sends one
 * message to that topic so every subscribed device is reached (the "notify everyone" model). All
 * delivery goes through the injected {@link PushSender} — a no-op logger until FCM is configured —
 * and is gated by the {@code push.enabled} setting, so this is safe to call unconditionally.
 */
@Log4j2
@Service
public class PushService {

    private static final String DEFAULT_IPO_TOPIC = "ipo-all";

    private final PushDeviceTokenRepository tokenRepo;
    private final PushSender sender;
    private final SettingsService settings;
    private final Clock clock;

    @Autowired
    public PushService(PushDeviceTokenRepository tokenRepo, PushSender sender, SettingsService settings) {
        this(tokenRepo, sender, settings, Clock.systemUTC());
    }

    PushService(PushDeviceTokenRepository tokenRepo, PushSender sender, SettingsService settings, Clock clock) {
        this.tokenRepo = tokenRepo;
        this.sender = sender;
        this.settings = settings;
        this.clock = clock;
    }

    /** Register (or refresh) a device token for a user and subscribe it to the broadcast topic. */
    @Transactional
    public void register(Long userId, String token, String platform) {
        if (token == null || token.isBlank()) {
            return;
        }
        String clean = token.trim();
        Instant now = clock.instant();
        PushDeviceTokenEntity entity = tokenRepo.findByToken(clean).orElseGet(PushDeviceTokenEntity::new);
        entity.setUserId(userId);
        entity.setToken(clean);
        entity.setPlatform(platform);
        entity.setLastSeenAt(now);
        tokenRepo.save(entity);
        sender.subscribeToTopic(List.of(clean), topic());
    }

    /** Forget a device token (e.g. logout / permission revoked). */
    @Transactional
    public void unregister(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        tokenRepo.deleteByToken(token.trim());
    }

    /** Broadcast one notification to everyone (the shared topic), honouring the enable flag. Kept
     * app-agnostic — IPO is just the first caller; any feature can broadcast through here. */
    public void broadcast(String title, String body, Map<String, String> data) {
        if (!settings.getBoolean(ConfigKeys.PUSH_ENABLED)) {
            log.debug("Push disabled (push.enabled=false) — skipping broadcast '{}'", title);
            return;
        }
        sender.sendToTopic(topic(), title, body, data == null ? Map.of() : data);
    }

    /** Whether push is enabled (the master flag) — for admin diagnostics. */
    public boolean isEnabled() {
        return settings.getBoolean(ConfigKeys.PUSH_ENABLED);
    }

    /** Whether a real FCM transport is wired + ready (vs the no-op logger) — for admin diagnostics. */
    public boolean isTransportReady() {
        return sender.isReady();
    }

    /** The configured broadcast topic, falling back to the built-in default when blank/unset. */
    public String topic() {
        String configured = settings.getString(ConfigKeys.PUSH_IPO_TOPIC);
        return (configured == null || configured.isBlank()) ? DEFAULT_IPO_TOPIC : configured.trim();
    }
}
