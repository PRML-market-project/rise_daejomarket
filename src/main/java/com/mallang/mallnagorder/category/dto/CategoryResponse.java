package com.mallang.mallnagorder.category.dto;

import com.mallang.mallnagorder.category.domain.Category;
import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.menu.domain.MenuCategory;
import lombok.*;

import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryResponse {
    private Long categoryId;
    private String categoryName;
    private String categoryNameEn;
    private String categoryType;
    private Long adminId;
    private List<MenuInfo> menus;

    public static CategoryResponse from(Category category) {
        return CategoryResponse.builder()
                .categoryId(category.getId())
                .categoryName(category.getCategoryName())
                .categoryNameEn(category.getCategoryNameEn())
                .categoryType(category.getCategoryType())
                .adminId(category.getAdminId())
                .menus(
                        category.getMenuCategories().stream()
                                .map(MenuCategory::getMenu)
                                .map(menu -> new MenuInfo(menu.getId(), menu.getMenuName(), menu.getMenuNameEn()))
                                .collect(Collectors.toList())
                )
                .build();
    }


    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MenuInfo {
        private Long menuId;
        private String menuName;
        private String menuNameEn;
    }
}
