package com.mallang.mallnagorder.admin.domain;

import com.mallang.mallnagorder.category.domain.Category;
import com.mallang.mallnagorder.kiosk.domain.Kiosk;
import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

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

    @OneToMany(mappedBy = "admin", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Kiosk> kiosks;

//    @OneToMany(mappedBy = "admin", cascade = CascadeType.ALL, orphanRemoval = true)
//    private List<Category> categories;
//
//    @OneToMany(mappedBy = "admin", cascade = CascadeType.ALL, orphanRemoval = true)
//    private List<Menu> menus;

}
