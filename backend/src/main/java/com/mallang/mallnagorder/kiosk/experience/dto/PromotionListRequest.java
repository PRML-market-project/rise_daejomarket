package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Getter
@NoArgsConstructor
public class PromotionListRequest {
    private List<PromotionContentDto> promotions = new ArrayList<>();
}
