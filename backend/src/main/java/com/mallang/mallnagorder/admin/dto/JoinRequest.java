package com.mallang.mallnagorder.admin.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class JoinRequest {

    private String email;
    private String password;
    private String adminName;
    private String storeName;
    private String storeNameEn;
}