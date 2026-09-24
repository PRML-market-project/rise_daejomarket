package com.mallang.mallnagorder.kiosk.experience.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.kiosk.experience.dto.ManagedShopDto;
import com.mallang.mallnagorder.translation.service.ArgosTranslatorService;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class KioskTranslationServiceTest {
    @Test
    void preservesCachedTranslationsAndTranslatesOnlyMissingText() throws Exception {
        var argos = mock(ArgosTranslatorService.class);
        when(argos.translateKioskTexts(anyList(), anySet())).thenReturn(Map.of("새 이름", Map.of("en", "New name", "vi", "Tên mới")));
        var service = new KioskTranslationService(argos, new ObjectMapper());
        var cache = Map.of("기존 이름", Map.of("en", "Old name", "vi", "Tên cũ"));
        var result = service.translate(Set.of("기존 이름", "새 이름"), cache);
        verify(argos).translateKioskTexts(eq(List.of("새 이름")), anySet());
        assertThat(result.get("기존 이름")).isEqualTo(cache.get("기존 이름"));
        assertThat(result.get("새 이름")).containsEntry("en", "New name");
        assertThat(cache).doesNotContainKey("새 이름");
    }

    @Test
    void gathersExistingMapAndAllManagedFieldsAndRetriesMissingLanguages() throws Exception {
        var argos = mock(ArgosTranslatorService.class);
        var service = new KioskTranslationService(argos, new ObjectMapper());
        var shop = new ManagedShopDto("id", "새 가게", "가게 설명", "검색어1, 검색어2", List.of("태그"), "/image.png", "식당");
        var sources = service.sources(List.of(shop), List.of());
        assertThat(sources).contains("남영상회", "새 가게", "가게 설명", "검색어1", "검색어2", "태그");
        assertThat(sources).doesNotContain("/image.png");
        assertThat(service.missing(Set.of("새 가게"), Map.of("새 가게", Map.of("en", "New shop")))).containsExactly("새 가게");
    }
}
