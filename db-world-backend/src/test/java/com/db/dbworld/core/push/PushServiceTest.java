package com.db.dbworld.core.push;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.core.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PushServiceTest {

    @Mock PushDeviceTokenRepository tokenRepo;
    @Mock PushSender sender;
    @Mock SettingsService settings;
    @Mock UserService userService;

    private static final Instant NOW = Instant.parse("2026-07-24T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private PushService service() {
        return new PushService(tokenRepo, sender, settings, userService, clock);
    }

    @Test
    void register_newToken_savesAndSubscribesToTopic() {
        when(settings.getString(ConfigKeys.PUSH_IPO_TOPIC)).thenReturn("ipo-all");
        when(tokenRepo.findByToken("tok-1")).thenReturn(Optional.empty());

        service().register(7L, "tok-1", "web");

        ArgumentCaptor<PushDeviceTokenEntity> captor = ArgumentCaptor.forClass(PushDeviceTokenEntity.class);
        verify(tokenRepo).save(captor.capture());
        PushDeviceTokenEntity saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(7L);
        assertThat(saved.getToken()).isEqualTo("tok-1");
        assertThat(saved.getPlatform()).isEqualTo("web");
        assertThat(saved.getLastSeenAt()).isEqualTo(NOW);
        verify(sender).subscribeToTopic(List.of("tok-1"), "ipo-all");
    }

    @Test
    void register_blankToken_isNoOp() {
        service().register(7L, "   ", "web");
        verifyNoInteractions(tokenRepo, sender);
    }

    @Test
    void unregister_deletesByToken() {
        service().unregister("tok-1");
        verify(tokenRepo).deleteByToken("tok-1");
    }

    @Test
    void broadcastIpo_whenDisabled_sendsNothing() {
        when(settings.getBoolean(ConfigKeys.PUSH_ENABLED)).thenReturn(false);
        service().broadcast("Title", "Body", Map.of(), "ipo");
        verify(sender, never()).sendToTopic(any(), any(), any(), any(), any());
    }

    @Test
    void broadcastIpo_whenEnabled_sendsToResolvedTopic_blankTopicFallsBackToDefault() {
        when(settings.getBoolean(ConfigKeys.PUSH_ENABLED)).thenReturn(true);
        when(settings.getString(ConfigKeys.PUSH_IPO_TOPIC)).thenReturn(""); // blank → built-in default
        service().broadcast("Title", "Body", null, "ipo");
        verify(sender).sendToTopic("ipo-all", "Title", "Body", Map.of(), "ipo");
    }

    @Test
    void sendToUsers_whenEnabled_dedupesTokensAndSendsWithChannel() {
        when(settings.getBoolean(ConfigKeys.PUSH_ENABLED)).thenReturn(true);
        when(tokenRepo.findByUserIdIn(List.of(1L, 2L))).thenReturn(List.of(
                token(1L, "tok-a"), token(2L, "tok-a"), token(2L, "tok-b")));

        service().sendToUsers(List.of(1L, 2L), "T", "B", Map.of("k", "v"), "request-updates");

        verify(sender).sendToTokens(
                argThat(tokens -> tokens.size() == 2 && tokens.contains("tok-a") && tokens.contains("tok-b")),
                eq("T"), eq("B"), eq(Map.of("k", "v")), eq("request-updates"));
    }

    @Test
    void sendToUsers_whenDisabled_sendsNothing() {
        when(settings.getBoolean(ConfigKeys.PUSH_ENABLED)).thenReturn(false);
        service().sendToUsers(List.of(1L), "T", "B", Map.of(), "request-updates");
        verifyNoInteractions(sender, tokenRepo);
    }

    @Test
    void sendToUsers_emptyUsers_isNoOp() {
        when(settings.getBoolean(ConfigKeys.PUSH_ENABLED)).thenReturn(true);
        service().sendToUsers(List.of(), "T", "B", Map.of(), "request-updates");
        verifyNoInteractions(sender, tokenRepo);
    }

    private static PushDeviceTokenEntity token(Long userId, String token) {
        return PushDeviceTokenEntity.builder().userId(userId).token(token).build();
    }
}
