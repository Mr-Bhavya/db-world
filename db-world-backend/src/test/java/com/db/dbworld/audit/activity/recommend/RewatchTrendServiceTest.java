package com.db.dbworld.audit.activity.recommend;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.audit.tracking.repository.ActivitySessionRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RewatchTrendServiceTest {

    @Test
    void refresh_readsKnobsFromSettings_andCachesResult() {
        SettingsService settings = mock(SettingsService.class);
        ActivitySessionRepository sessions = mock(ActivitySessionRepository.class);
        when(settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)).thenReturn(true);
        when(settings.getInt(ConfigKeys.RECOMMEND_REWATCH_WINDOW_DAYS)).thenReturn(7);
        when(settings.getInt(ConfigKeys.RECOMMEND_REWATCH_MIN_SCORE)).thenReturn(3);
        when(settings.getInt(ConfigKeys.RECOMMEND_REWATCH_TOP_N)).thenReturn(30);
        when(sessions.findTopRewatchedRecordIds(7, 3, 30)).thenReturn(List.of(5L, 9L));

        RewatchTrendService svc = new RewatchTrendService(settings, sessions);
        svc.refresh();

        assertThat(svc.snapshot()).containsExactly(5L, 9L);
    }

    @Test
    void refresh_whenDisabled_isNoOp() {
        SettingsService settings = mock(SettingsService.class);
        ActivitySessionRepository sessions = mock(ActivitySessionRepository.class);
        when(settings.getBoolean(ConfigKeys.RECOMMEND_REWATCH_ENABLED)).thenReturn(false);

        RewatchTrendService svc = new RewatchTrendService(settings, sessions);
        svc.refresh();

        verifyNoInteractions(sessions);
        assertThat(svc.snapshot()).isEmpty();
    }
}
