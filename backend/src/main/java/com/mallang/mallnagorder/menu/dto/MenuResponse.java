package com.mallang.mallnagorder.menu.dto;

import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.menu.domain.MenuCategory;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MenuResponse {
    private Long menuId;
    private String menuName;
    private String menuNameEn;
    private String menuNameVi;
    private BigDecimal menuPrice;
    private String menuCount;
    private String menuCountVi;
    private String imageUrl;
    private Long adminId;
    private List<CategoryInfo> categories;

    public static MenuResponse from(Menu menu) {
        return MenuResponse.builder()
                .menuId(menu.getId())
                .menuName(menu.getMenuName())
                .menuNameEn(menu.getMenuNameEn())
                .menuNameVi(menu.getMenuNameVi())
                .menuPrice(menu.getMenuPrice())
                .menuCount(menu.getMenuCount())
                .menuCountVi(menu.getMenuCountVi())
                .imageUrl(menu.getImageUrl())
                .adminId(menu.getAdminId())
                .categories(
                        menu.getMenuCategories().stream()
                                .map(MenuCategory::getCategory)
                                .map(category -> new CategoryInfo(
                                        category.getId(),
                                        category.getCategoryName(),
                                        category.getCategoryNameEn(),
                                        category.getCategoryNameVi()
                                ))
                                .collect(Collectors.toList())
                )
                .build();
    }


    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CategoryInfo {
        private Long categoryId;
        private String categoryName;
        private String categoryNameEn;
        private String categoryNameVi;
    }
}
