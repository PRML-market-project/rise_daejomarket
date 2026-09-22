package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SearchTagDto {
    private Long id;
    private String name;
    private String keywords;
    private String icon;
    private String iconUrl;
    private Boolean visible;
}
