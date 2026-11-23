package com.mallang.mallnagorder.kiosk.analytics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.kiosk.experience.dto.KioskExperienceResponse;
import com.mallang.mallnagorder.kiosk.experience.dto.ManagedShopDto;
import com.mallang.mallnagorder.kiosk.experience.service.KioskExperienceService;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class KioskAnalyticsServiceTest {
    final KioskAnalyticsRepository repository = mock(KioskAnalyticsRepository.class);
    final KioskExperienceService experience = mock(KioskExperienceService.class);
    final ObjectMapper mapper = new ObjectMapper();
    final KioskAnalyticsService service = new KioskAnalyticsService(repository, experience, mapper);
    KioskAnalyticsServiceTest() throws Exception {}

    KioskAnalyticsEvent event(String type, String timestamp, String targets) {
        var event = new KioskAnalyticsEvent(); event.setId(UUID.randomUUID().toString());
        event.setType(type); event.setSessionId(UUID.randomUUID().toString()); event.setSource("touch"); event.setLanguage("ko");
        event.setOccurredAt(Instant.parse(timestamp)); event.setTargetsJson(targets); return event;
    }
    @Test void appliesKoreaDateBoundariesAndDeduplicatesCategoriesAndProductsPerSearch() {
        String targets = "[{\"id\":\"one\",\"name\":\"One\",\"category\":\"food\",\"products\":[\"rice\",\"rice\"]},{\"id\":\"two\",\"name\":\"Two\",\"category\":\"food\",\"products\":[\"rice\"]}]";
        var records = List.of(event("START", "2025-12-31T15:00:00Z", "[]"), event("START", "2025-12-31T14:59:59Z", "[]"),
                event("SEARCH", "2025-12-31T15:01:00Z", targets), event("SEARCH", "2025-12-31T15:02:00Z", "[]"),
                event("SELECT", "2025-12-31T15:03:00Z", "[{\"id\":\"one\",\"name\":\"One\",\"category\":\"food\",\"products\":[]}]"));
        when(repository.findByOccurredAtGreaterThanEqualAndOccurredAtLessThanOrderByOccurredAtAsc(any(), any())).thenReturn(records);
        var summary = service.summary(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 1), 2026);
        assertThat(summary.totalUses()).isEqualTo(1);
        assertThat(summary.searches()).isEqualTo(2); assertThat(summary.noResults()).isEqualTo(1);
        assertThat(summary.categories()).containsExactly(new KioskAnalyticsService.Rank("food", "food", 1));
        assertThat(summary.products()).containsExactly(new KioskAnalyticsService.Rank("rice", "rice", 1));
        assertThat(summary.shops()).containsExactly(new KioskAnalyticsService.Rank("one", "One", 1));
        assertThat(summary.hours()).containsExactly(new KioskAnalyticsService.Bucket("2026-01-01T00", 1));
        verify(repository).findByOccurredAtGreaterThanEqualAndOccurredAtLessThanOrderByOccurredAtAsc(Instant.parse("2025-12-31T15:00:00Z"), Instant.parse("2026-12-31T15:00:00Z"));
    }
    @Test void storesCanonicalIdsWithServerCatalogAndSnapshotsManagedTags() throws Exception {
        var response = mock(KioskExperienceResponse.class);
        when(experience.get()).thenReturn(response);
        when(response.getShops()).thenReturn(List.of(new ManagedShopDto("585:28762", "Renamed", "", "", List.of("rice", "rice"), "", "")));
        var request = new KioskAnalyticsService.EventRequest(UUID.randomUUID().toString(), "SEARCH", UUID.randomUUID().toString(), "voice", "ko", List.of("585:28762", "585:28762"), Instant.now().minusSeconds(20));
        service.record(request);
        var captor = org.mockito.ArgumentCaptor.forClass(KioskAnalyticsEvent.class);
        verify(repository).saveAndFlush(captor.capture());
        var saved = captor.getValue();
        assertThat(saved.getOccurredAt()).isEqualTo(request.occurredAt());
        var snapshots = mapper.readTree(saved.getTargetsJson());
        assertThat(snapshots.size()).isEqualTo(1); assertThat(snapshots.get(0).get("name").asText()).isEqualTo("Renamed");
        assertThat(snapshots.get(0).get("category").asText()).isEqualTo("식당");
        assertThat(snapshots.get(0).get("products").size()).isEqualTo(1);
    }
    @Test void retriesDoNotInsertSameEventAndUnknownIdsAreRejected() {
        var id = UUID.randomUUID().toString(); when(repository.existsById(id)).thenReturn(true);
        service.record(new KioskAnalyticsService.EventRequest(id, "START", UUID.randomUUID().toString(), "touch", "ko", List.of(), null));
        verify(repository, never()).saveAndFlush(any());
        assertThatThrownBy(() -> service.record(new KioskAnalyticsService.EventRequest(UUID.randomUUID().toString(), "SEARCH", UUID.randomUUID().toString(), "tag", "ko", List.of("unknown"), null))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void csvUsesKoreaTimestampsEscapesQuotesAndBlocksSpreadsheetFormulas() {
        var target = "[{\"id\":\"x\",\"name\":\"=HYPERLINK(\\\"bad\\\")\",\"category\":\"food\",\"products\":[]}]";
        when(repository.findByOccurredAtGreaterThanEqualAndOccurredAtLessThanOrderByOccurredAtAsc(any(), any())).thenReturn(List.of(event("SELECT", "2026-01-01T15:00:00Z", target)));
        String csv = service.csv(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2), "events");
        assertThat(csv).startsWith("\uFEFF").contains("2026-01-02T00:00+09:00").contains("'‌=HYPERLINK".replace("‌", "")).contains("\"\"bad\"\"");
        assertThatThrownBy(() -> service.csv(LocalDate.of(2026, 1, 2), LocalDate.of(2026, 1, 1), "events")).isInstanceOf(IllegalArgumentException.class);
    }
}
