package com.mallang.mallnagorder.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class StoreInfoResponse {
    private String email;
    private String adminName;
    private String storeName;
    private String storeNameEn;
    private String storeNameVi;
    private int kioskCount;
}
