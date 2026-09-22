package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ManagedShopDto {
    private String id;
    private String name;
    private String description;
    private String keywords;
    private List<String> tags;
    private String thumbnailUrl;
    private String icon;
}
