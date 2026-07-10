package com.db.dbworld.app.admin.config.service;

import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import com.db.dbworld.app.admin.config.entity.ConfigValueType;
import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.repository.AppConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SettingsServiceTest {

    AppConfigRepository repo;
    SettingsService service;
    Map<String, AppConfigEntity> store;

    @BeforeEach
    void setUp() {
        repo = mock(AppConfigRepository.class);
        store = new HashMap<>();
        when(repo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(repo.findAll()).thenAnswer(a -> new ArrayList<>(store.values()));
        when(repo.existsById(any())).thenAnswer(a -> store.containsKey(a.getArgument(0)));
        when(repo.save(any(AppConfigEntity.class))).thenAnswer(a -> {
            AppConfigEntity e = a.getArgument(0);
            store.put(e.getConfigKey(), e);
            return e;
        });
        service = new SettingsService(repo);
        service.init(); // seeds + loads cache
    }

    @Test
    void seed_populatesCatalogRows_idempotently() {
        int after1 = store.size();
        service.init(); // run again
        assertThat(store.size()).isEqualTo(after1);
        assertThat(after1).isEqualTo(25);
    }

    @Test
    void getInt_returnsSeededDefault() {
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }

    @Test
    void getBoolean_returnsSeededDefault() {
        assertThat(service.getBoolean(ConfigKeys.CDN_SIGNING_ENABLED)).isTrue();
    }

    @Test
    void getInt_missingKey_fallsBackToCatalogDefault() {
        store.clear();          // simulate empty table
        service.reloadCache();  // cache now empty
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }

    @Test
    void getInt_garbageValue_fallsBackToDefault_neverThrows() {
        AppConfigEntity row = store.get(ConfigKeys.RECOMMEND_GENRE_TOP_N);
        row.setValue("not-a-number");
        service.reloadCache();
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }

    @Test
    void getInt_wrongTypeKey_returnsZero_neverThrows() {
        // TRACKING_ENABLED is BOOLEAN, not INTEGER — getInt must never attempt to
        // parse its (or the catalog default's) value as a number.
        assertThat(service.getInt(ConfigKeys.TRACKING_ENABLED)).isZero();
    }

    @Test
    void getLong_garbageValue_fallsBackToDefault_neverThrows() {
        AppConfigEntity row = store.get(ConfigKeys.TRACKING_BATCH_TICK_MS);
        row.setValue("not-a-number");
        service.reloadCache();
        assertThat(service.getLong(ConfigKeys.TRACKING_BATCH_TICK_MS)).isEqualTo(5000L);
    }

    @Test
    void update_persistsAndRefreshesCache() {
        service.update(ConfigKeys.RECOMMEND_GENRE_TOP_N, "7", "tester");
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(7);
        assertThat(store.get(ConfigKeys.RECOMMEND_GENRE_TOP_N).getUpdatedBy()).isEqualTo("tester");
    }

    @Test
    void update_rejectsWrongType() {
        assertThatThrownBy(() -> service.update(ConfigKeys.RECOMMEND_GENRE_TOP_N, "abc", "t"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void update_rejectsOutOfBounds() {
        assertThatThrownBy(() -> service.update(ConfigKeys.RECOMMEND_GENRE_COMPLETION_THRESHOLD, "150", "t"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void update_rejectsUnknownKey() {
        assertThatThrownBy(() -> service.update("no.such.key", "1", "t"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reset_restoresDefault() {
        service.update(ConfigKeys.RECOMMEND_GENRE_TOP_N, "7", "t");
        service.reset(ConfigKeys.RECOMMEND_GENRE_TOP_N, "t");
        assertThat(service.getInt(ConfigKeys.RECOMMEND_GENRE_TOP_N)).isEqualTo(3);
    }
}
