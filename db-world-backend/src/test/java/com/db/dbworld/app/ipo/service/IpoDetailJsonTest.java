package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.dto.IpoIssueObjectDto;
import com.db.dbworld.app.ipo.dto.IpoKpiDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IpoDetailJsonTest {

    @Test
    void kpis_roundTripPreservesOrderAndValues() {
        List<IpoKpiDto> kpis = List.of(
                new IpoKpiDto("ROE", "34.78%"),
                new IpoKpiDto("P/E (x)", "16.3"),
                new IpoKpiDto("Market Cap", "₹664.03 Cr."));

        String json = IpoDetailJson.kpisToJson(kpis);

        assertThat(json).isNotNull();
        assertThat(IpoDetailJson.kpisFromJson(json)).isEqualTo(kpis);
    }

    @Test
    void issueObjects_roundTripKeepsNullAmount() {
        List<IpoIssueObjectDto> objects = List.of(
                new IpoIssueObjectDto("To Meet Working Capital Requirements", "₹102.00 Cr"),
                new IpoIssueObjectDto("General corporate purposes", null));

        String json = IpoDetailJson.issueObjectsToJson(objects);

        assertThat(IpoDetailJson.issueObjectsFromJson(json)).isEqualTo(objects);
    }

    @Test
    void nullOrEmptyList_serializesToNull() {
        assertThat(IpoDetailJson.kpisToJson(null)).isNull();
        assertThat(IpoDetailJson.kpisToJson(List.of())).isNull();
        assertThat(IpoDetailJson.issueObjectsToJson(null)).isNull();
        assertThat(IpoDetailJson.issueObjectsToJson(List.of())).isNull();
    }

    @Test
    void blankOrMalformedJson_deserializesToEmptyList() {
        assertThat(IpoDetailJson.kpisFromJson(null)).isEmpty();
        assertThat(IpoDetailJson.kpisFromJson("")).isEmpty();
        assertThat(IpoDetailJson.kpisFromJson("not json")).isEmpty();
        assertThat(IpoDetailJson.issueObjectsFromJson("{bad")).isEmpty();
    }
}
