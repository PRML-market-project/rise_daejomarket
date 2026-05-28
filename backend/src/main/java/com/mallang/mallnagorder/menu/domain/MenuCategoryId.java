package com.mallang.mallnagorder.menu.domain;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Access(AccessType.FIELD)
public class MenuCategoryId implements Serializable {

    @Column(name = "menu_id")
    private Long menuId;

    @Column(name = "category_id")
    private Long categoryId;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MenuCategoryId that)) return false;
        return Objects.equals(menuId, that.menuId) &&
                Objects.equals(categoryId, that.categoryId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(menuId, categoryId);
    }

    public void setMenuId(Long menuId) {
        this.menuId = menuId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

}


