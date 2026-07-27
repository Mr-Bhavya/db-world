package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IpoSourceRegistryTest {

    @Mock
    SettingsService settingsService;

    private static IpoSource fake(String key) {
        IpoSource s = mock(IpoSource.class);
        when(s.key()).thenReturn(key);
        return s;
    }

    @Test
    void enabled_returnsOnlyConfiguredSources_preservingInjectedOrderNotCsvOrder() {
        IpoSource ipoguru = fake("ipoguru");
        IpoSource nse = fake("nse");
        IpoSource chittorgarh = fake("chittorgarh");
        // CSV lists chittorgarh before nse — the registry must NOT reorder to match the CSV.
        when(settingsService.getString(ConfigKeys.IPO_SOURCES_ENABLED)).thenReturn("chittorgarh,nse");

        IpoSourceRegistry registry = new IpoSourceRegistry(List.of(ipoguru, nse, chittorgarh), settingsService);

        assertThat(registry.enabled()).containsExactly(nse, chittorgarh);
    }

    @Test
    void enabled_blankCsv_returnsEmptyList() {
        IpoSource ipoguru = fake("ipoguru");
        when(settingsService.getString(ConfigKeys.IPO_SOURCES_ENABLED)).thenReturn("");

        IpoSourceRegistry registry = new IpoSourceRegistry(List.of(ipoguru), settingsService);

        assertThat(registry.enabled()).isEmpty();
    }

    @Test
    void enabled_nullCsv_returnsEmptyList() {
        IpoSource ipoguru = fake("ipoguru");
        when(settingsService.getString(ConfigKeys.IPO_SOURCES_ENABLED)).thenReturn(null);

        IpoSourceRegistry registry = new IpoSourceRegistry(List.of(ipoguru), settingsService);

        assertThat(registry.enabled()).isEmpty();
    }

    @Test
    void enabled_isCaseInsensitiveAndTrimsWhitespace() {
        IpoSource ipoguru = fake("ipoguru");
        when(settingsService.getString(ConfigKeys.IPO_SOURCES_ENABLED)).thenReturn(" IPOGURU ,  nse  ");

        IpoSourceRegistry registry = new IpoSourceRegistry(List.of(ipoguru), settingsService);

        assertThat(registry.enabled()).containsExactly(ipoguru);
    }

    @Test
    void enabled_unknownKeyInCsv_isIgnored() {
        IpoSource ipoguru = fake("ipoguru");
        when(settingsService.getString(ConfigKeys.IPO_SOURCES_ENABLED)).thenReturn("ipoguru,some-unregistered-source");

        IpoSourceRegistry registry = new IpoSourceRegistry(List.of(ipoguru), settingsService);

        assertThat(registry.enabled()).containsExactly(ipoguru);
    }
}
