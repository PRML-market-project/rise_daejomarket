package com.mallang.mallnagorder.menu.domain;

import com.mallang.mallnagorder.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Menu extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String menuName;

    @Column(nullable = false, length = 100)
    private String menuNameEn;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal menuPrice;

    @Column(nullable = false, length = 2083)
    private String imageUrl = "";

    @Column(name = "admin_id", nullable = false)
    private Long adminId;

    @Column(nullable = false)
    private String menuCount;

    @OneToMany(mappedBy = "menu", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<MenuCategory> menuCategories = new ArrayList<>();

    private boolean visible;

    public boolean isVisible() {
        return this.visible;
    }

    public void addMenuCategory(MenuCategory menuCategory) {
        // 중복 체크
        boolean exists = this.menuCategories.stream()
                .anyMatch(mc -> mc.getId().equals(menuCategory.getId()));
        if (!exists) {
            this.menuCategories.add(menuCategory);
            menuCategory.getCategory().getMenuCategories().add(menuCategory);
        }
    }

    public void removeMenuCategory(MenuCategory menuCategory) {
        this.menuCategories.remove(menuCategory);
        menuCategory.getCategory().getMenuCategories().remove(menuCategory);
    }

}
