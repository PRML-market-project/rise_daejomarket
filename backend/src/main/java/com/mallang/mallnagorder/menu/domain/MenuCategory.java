package com.mallang.mallnagorder.menu.domain;

import com.mallang.mallnagorder.category.domain.Category;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "menu_category")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Access(AccessType.FIELD)
public class MenuCategory {

    @EmbeddedId
    private MenuCategoryId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("menuId")
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("categoryId")
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    public static MenuCategory of(Menu menu, Category category) {
        MenuCategory mc = new MenuCategory();
        mc.setMenu(menu);
        mc.setCategory(category);
        mc.setId(new MenuCategoryId(menu.getId(), category.getId()));
        return mc;
    }
}


