package com.db.dbworld.core.push;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.entity.UserEntity;
import com.db.dbworld.core.user.service.UserService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
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

    /** Topic reaching admin/owner devices only — for admin-facing alerts (new requests, ingestion). */
    static final String ADMIN_TOPIC = "dbworld-admins";

    private final PushDeviceTokenRepository tokenRepo;
    private final PushSender sender;
    private final SettingsService settings;
    private final UserService userService;
    private final Clock clock;

    @Autowired
    public PushService(PushDeviceTokenRepository tokenRepo, PushSender sender, SettingsService settings,
                       UserService userService) {
        this(tokenRepo, sender, settings, userService, Clock.systemUTC());
    }

    PushService(PushDeviceTokenRepository tokenRepo, PushSender sender, SettingsService settings,
                UserService userService, Clock clock) {
        this.tokenRepo = tokenRepo;
        this.sender = sender;
        this.settings = settings;
        this.userService = userService;
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
        syncAdminSubscription(userId, clean);
    }

    /**
     * Keep this device's admin-topic membership in step with the user's current role: admins/owners
     * are subscribed, everyone else is unsubscribed (so a demoted user or a re-used shared device
     * stops receiving admin pushes). Fully defensive — a missing user or any lookup failure must
     * never break device registration.
     */
    private void syncAdminSubscription(Long userId, String cleanToken) {
        boolean isAdmin = false;
        try {
            if (userId != null) {
                UserEntity user = userService.getUserEntityById(userId);
                Role role = (user != null && user.getRole() != null) ? user.getRole().getName() : null;
                isAdmin = role == Role.ADMIN || role == Role.OWNER;
            }
        } catch (Exception e) {
            log.debug("Admin-subscription role lookup failed for userId={} — treating as non-admin: {}",
                    userId, e.toString());
        }
        try {
            if (isAdmin) {
                sender.subscribeToTopic(List.of(cleanToken), ADMIN_TOPIC);
            } else {
                sender.unsubscribeFromTopic(List.of(cleanToken), ADMIN_TOPIC);
            }
        } catch (Exception e) {
            log.debug("Admin-topic (un)subscribe failed for userId={}: {}", userId, e.toString());
        }
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
     * app-agnostic — IPO is just the first caller; any feature can broadcast through here. The
     * {@code channelId} tags the Android notification channel (e.g. {@code "ipo"}, {@code "cinema"});
     * pass null/blank for the device default. */
    public void broadcast(String title, String body, Map<String, String> data, String channelId) {
        if (!settings.getBoolean(ConfigKeys.PUSH_ENABLED)) {
            log.debug("Push disabled (push.enabled=false) — skipping broadcast '{}'", title);
            return;
        }
        sender.sendToTopic(topic(), title, body, data == null ? Map.of() : data, channelId);
    }

    /** Broadcast one notification to admin/owner devices only (the {@link #ADMIN_TOPIC}), honouring
     * the enable flag exactly like {@link #broadcast}. Used for admin-facing alerts (channel
     * {@code "admin"}). */
    public void broadcastToAdmins(String title, String body, Map<String, String> data, String channelId) {
        if (!settings.getBoolean(ConfigKeys.PUSH_ENABLED)) {
            log.debug("Push disabled (push.enabled=false) — skipping admin broadcast '{}'", title);
            return;
        }
        sender.sendToTopic(ADMIN_TOPIC, title, body, data == null ? Map.of() : data, channelId);
    }

    /**
     * Deliver one notification to specific users (targeted push, not a broadcast) — used for
     * per-user alerts like "your request was fulfilled". Looks up every device token registered to
     * any of {@code userIds}, dedupes, and hands them to the sender. Gated on {@code push.enabled}
     * and fully best-effort: no tokens (or any failure) is a clean no-op that never propagates.
     */
    public void sendToUsers(Collection<Long> userIds, String title, String body,
                            Map<String, String> data, String channelId) {
        if (!settings.getBoolean(ConfigKeys.PUSH_ENABLED)) {
            log.debug("Push disabled (push.enabled=false) — skipping user push '{}'", title);
            return;
        }
        if (userIds == null || userIds.isEmpty()) {
            return;
        }
        try {
            List<String> tokens = tokenRepo.findByUserIdIn(userIds).stream()
                    .map(PushDeviceTokenEntity::getToken)
                    .filter(t -> t != null && !t.isBlank())
                    .distinct()
                    .toList();
            if (tokens.isEmpty()) {
                return;
            }
            sender.sendToTokens(tokens, title, body, data == null ? Map.of() : data, channelId);
        } catch (Exception e) {
            log.warn("User push '{}' failed for {} user(s): {}", title, userIds.size(), e.toString());
        }
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
