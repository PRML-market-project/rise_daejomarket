package com.mallang.mallnagorder.kiosk.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivateKioskResponse {
    private Long adminId;
    private Long kioskId;
}
