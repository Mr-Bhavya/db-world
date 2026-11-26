package com.db.dbworld.app.brand;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BrandSearchServiceTest {

    @Test
    void search_worksWithoutOnlineSecretForKnownBrands() {
        LogoDevProperties properties = new LogoDevProperties();
        properties.setSecretKey("");
        BrandSearchService service = new BrandSearchService(properties);

        assertThat(service.search("Net flix"))
                .extracting(BrandSuggestion::domain)
                .contains("netflix.com");
        assertThat(service.search("GitHub"))
                .extracting(BrandSuggestion::domain)
                .contains("github.com");
    }

    @Test
    void search_ignoresVeryShortQueries() {
        LogoDevProperties properties = new LogoDevProperties();
        BrandSearchService service = new BrandSearchService(properties);

        assertThat(service.search("n")).isEmpty();
    }
}
