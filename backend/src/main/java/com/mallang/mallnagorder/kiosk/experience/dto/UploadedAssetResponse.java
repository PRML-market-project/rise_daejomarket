package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UploadedAssetResponse {
    private String name;
    private String type;
    private String url;
}
