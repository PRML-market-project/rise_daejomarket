package com.mallang.mallnagorder.kiosk.experience.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.kiosk.experience.domain.KioskExperience;
import com.mallang.mallnagorder.kiosk.experience.dto.PromotionContentDto;
import com.mallang.mallnagorder.kiosk.experience.repository.KioskExperienceRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class KioskExperienceServiceTest {
    private final KioskExperienceRepository repository = mock(KioskExperienceRepository.class);
    private final KioskTranslationService translations = mock(KioskTranslationService.class);
    private final KioskExperienceService service = new KioskExperienceService(repository, new ObjectMapper(), translations);

    private List<PromotionContentDto> contents(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(index -> new PromotionContentDto(
                (long) index, "Poster " + index, index % 2 == 0 ? "video" : "image",
                "/images/promotions/" + index, 10, "contain")).toList();
    }

    @Test
    void savesAndReturnsThirtyContentsInPlaylistOrder() {
        var config = new KioskExperience();
        when(repository.findAll()).thenReturn(List.of(config));
        when(repository.save(any(KioskExperience.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(translations.withSeeds(anyMap())).thenReturn(Map.of());
        when(translations.sources(anyList(), anyList())).thenReturn(Set.of());
        when(translations.missing(anySet(), anyMap())).thenReturn(List.of());

        var promotions = contents(30);
        var response = service.updatePromotions(promotions);

        assertThat(response.getPromotions()).hasSize(30);
        assertThat(response.getPromotions()).extracting(PromotionContentDto::getId)
                .containsExactlyElementsOf(promotions.stream().map(PromotionContentDto::getId).toList());
        verify(repository).save(config);
    }

    @Test
    void rejectsThirtyOneContentsWithoutChangingSavedPlaylist() {
        assertThatThrownBy(() -> service.updatePromotions(contents(31)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("홍보 콘텐츠는 최대 30개까지 등록할 수 있습니다.");
        verifyNoInteractions(repository, translations);
    }
}
