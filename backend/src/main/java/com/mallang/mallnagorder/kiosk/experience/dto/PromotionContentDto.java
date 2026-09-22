package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PromotionContentDto {
    private Long id;
    private String name;
    private String type;
    private String url;
    private Integer durationSeconds;
    private String fit;
}
