package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class KioskExperienceResponse {
    private String operationMode;
    private List<PromotionContentDto> promotions;
    private List<SearchTagDto> searchTags;
    private List<ManagedShopDto> shops;
}
