package com.mallang.mallnagorder.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.mallang.mallnagorder.category.domain.Category;
import com.mallang.mallnagorder.menu.domain.Menu;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Builder
@AllArgsConstructor
public class AdminPayloadDto {

    @JsonProperty("admin_id")
    private Long adminId;
    private List<CategoryView> categories;

    public static AdminPayloadDto from(Long adminId, List<Category> categories) {
        return AdminPayloadDto.builder()
                .adminId(adminId)
                .categories(categories.stream()
                        .map(CategoryView::from)
                        .collect(Collectors.toList()))
                .build();
    }

    @Getter
    @Builder
    @AllArgsConstructor
    public static class CategoryView {
        private Long categoryId;
        private String categoryName;
        private String categoryNameEn;
        private String categoryType;
        private List<MenuView> menus;

        public static CategoryView from(Category category) {
            return CategoryView.builder()
                    .categoryId(category.getId())
                    .categoryName(category.getCategoryName())
                    .categoryNameEn(category.getCategoryNameEn())
                    .categoryType(category.getCategoryType())
                    .categoryType(category.getCategoryType() != null ? category.getCategoryType() : "")//추가
                    .menus(
                            java.util.Optional.ofNullable(category.getMenuCategories())
                                    .orElse(List.of()) // 빈 리스트로 대체
                                    .stream()
                                    .map(menuCategory -> MenuView.from(menuCategory.getMenu()))
                                    .collect(Collectors.toList())
                    )
                    .build();
        }
    }

    @Getter
    @Builder
    @AllArgsConstructor
    public static class MenuView {
        private Long menuId;
        private String menuName;
        private String menuNameEn;
        private BigDecimal menuPrice;
        private String menuCount;

        public static MenuView from(Menu menu) {
            return MenuView.builder()
                    .menuId(menu.getId())
                    .menuName(menu.getMenuName())
                    .menuNameEn(menu.getMenuNameEn())
                    .menuPrice(menu.getMenuPrice())
                    .menuCount(menu.getMenuCount())
                    .build();
        }
    }
}
