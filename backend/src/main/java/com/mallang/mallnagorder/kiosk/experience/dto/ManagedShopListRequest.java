package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Getter
@NoArgsConstructor
public class ManagedShopListRequest {
    private List<ManagedShopDto> shops = new ArrayList<>();
}
