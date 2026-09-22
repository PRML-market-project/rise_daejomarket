package com.mallang.mallnagorder.kiosk.experience.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.kiosk.experience.domain.KioskExperience;
import com.mallang.mallnagorder.kiosk.experience.dto.KioskExperienceResponse;
import com.mallang.mallnagorder.kiosk.experience.dto.ManagedShopDto;
import com.mallang.mallnagorder.kiosk.experience.dto.PromotionContentDto;
import com.mallang.mallnagorder.kiosk.experience.dto.SearchTagDto;
import com.mallang.mallnagorder.kiosk.experience.repository.KioskExperienceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class KioskExperienceService {
    private static final Set<String> MODES = Set.of("DIRECTIONS", "PROMOTION");
    private final KioskExperienceRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public KioskExperienceResponse get() {
        return toResponse(getOrCreate());
    }

    @Transactional
    public KioskExperienceResponse updateMode(String mode) {
        if (!MODES.contains(mode)) throw new IllegalArgumentException("지원하지 않는 운영 모드입니다.");
        KioskExperience config = getOrCreate();
        config.setOperationMode(mode);
        return toResponse(repository.save(config));
    }

    @Transactional
    public KioskExperienceResponse updatePromotions(List<PromotionContentDto> promotions) {
        List<PromotionContentDto> safePromotions = promotions == null ? List.of() : promotions;
        safePromotions.stream()
                .filter(item -> "image".equals(item.getType()))
                .forEach(item -> {
                    Integer seconds = item.getDurationSeconds();
                    if (seconds == null || seconds < 5 || seconds > 30 || seconds % 5 != 0) {
                        throw new IllegalArgumentException("이미지 노출 시간은 5초 단위로 5초부터 30초까지 설정할 수 있습니다.");
                    }
                });
        KioskExperience config = getOrCreate();
        config.setPromotionsJson(write(safePromotions));
        return toResponse(repository.save(config));
    }

    @Transactional
    public KioskExperienceResponse updateSearchTags(List<SearchTagDto> tags) {
        List<SearchTagDto> safeTags = tags == null ? List.of() : tags;
        if (safeTags.stream().filter(tag -> Boolean.TRUE.equals(tag.getVisible())).count() > 3) {
            throw new IllegalArgumentException("키오스크에 표시할 검색 태그는 최대 3개입니다.");
        }
        KioskExperience config = getOrCreate();
        config.setSearchTagsJson(write(safeTags));
        return toResponse(repository.save(config));
    }

    @Transactional
    public KioskExperienceResponse updateShops(List<ManagedShopDto> shops) {
        KioskExperience config = getOrCreate();
        config.setShopsJson(write(shops == null ? List.of() : shops));
        return toResponse(repository.save(config));
    }

    private KioskExperience getOrCreate() {
        return repository.findAll().stream().findFirst().orElseGet(() -> repository.save(new KioskExperience()));
    }

    private KioskExperienceResponse toResponse(KioskExperience config) {
        return new KioskExperienceResponse(
                config.getOperationMode(),
                read(config.getPromotionsJson(), new TypeReference<>() {}),
                read(config.getSearchTagsJson(), new TypeReference<>() {}),
                read(config.getShopsJson(), new TypeReference<>() {})
        );
    }

    private String write(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException e) { throw new IllegalStateException("설정을 저장하지 못했습니다.", e); }
    }

    private <T> T read(String json, TypeReference<T> type) {
        try { return objectMapper.readValue(json, type); }
        catch (JsonProcessingException e) { throw new IllegalStateException("저장된 설정을 읽지 못했습니다.", e); }
    }
}
