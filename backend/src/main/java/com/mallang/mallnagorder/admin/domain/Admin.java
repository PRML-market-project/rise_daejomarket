package com.mallang.mallnagorder.admin.domain;

import com.mallang.mallnagorder.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Admin extends BaseEntity {

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false, length = 100)
    private String password;

    @Column(nullable = false, length = 100)
    private String adminName;

    @Column(nullable = false, length = 100)
    private String storeName;

    @Column(nullable = true, length = 100)
    private String storeNameEn;

    @Column(length = 150)
    private String storeNameVi;
}
