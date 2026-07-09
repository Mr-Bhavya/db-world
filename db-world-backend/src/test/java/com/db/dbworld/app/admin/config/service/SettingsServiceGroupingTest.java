package com.db.dbworld.app.admin.config.service;

import com.db.dbworld.app.admin.config.dto.SettingCategoryDto;
import com.db.dbworld.app.admin.config.entity.AppConfigEntity;
import com.db.dbworld.app.admin.config.repository.AppConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SettingsServiceGroupingTest {

    SettingsService service;

    @BeforeEach
    void setUp() {
        AppConfigRepository repo = mock(AppConfigRepository.class);
        Map<String, AppConfigEntity> store = new HashMap<>();
        when(repo.findById(any())).thenAnswer(a -> Optional.ofNullable(store.get(a.getArgument(0))));
        when(repo.findAll()).thenAnswer(a -> new ArrayList<>(store.values()));
        when(repo.existsById(any())).thenAnswer(a -> store.containsKey(a.getArgument(0)));
        when(repo.save(any(AppConfigEntity.class))).thenAnswer(a -> {
            AppConfigEntity e = a.getArgument(0); store.put(e.getConfigKey(), e); return e;
        });
        service = new SettingsService(repo);
        service.init();
    }

    @Test
    void listGrouped_groupsByCategory_andOrders() {
        List<SettingCategoryDto> groups = service.listGrouped();
        assertThat(groups).extracting(SettingCategoryDto::category)
                .contains("Recommendations", "Activity Tracking", "Weather", "CDN Signing");
        // within a category, settings are ordered by displayOrder
        SettingCategoryDto rec = groups.stream()
                .filter(g -> g.category().equals("Recommendations")).findFirst().orElseThrow();
        assertThat(rec.settings().get(0).key()).isEqualTo("recommend.genre.enabled");
    }
}
