package com.mallang.mallnagorder.kiosk.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ActivateKioskRequest {
    private String storeName;
    private int kioskNumber;
}
