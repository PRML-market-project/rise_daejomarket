package com.mallang.mallnagorder.category.repository;

import com.mallang.mallnagorder.menu.domain.MenuCategory;
import com.mallang.mallnagorder.menu.domain.MenuCategoryId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuCategoryRepository extends JpaRepository<MenuCategory, MenuCategoryId> {
    List<MenuCategory> findByIdCategoryId(Long categoryId); // EmbeddedId 기준
    List<MenuCategory> findByIdMenuId(Long menuId);         // EmbeddedId 기준
}

