package com.mallang.mallnagorder.category.service;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.admin.exception.AdminException;
import com.mallang.mallnagorder.admin.exception.AdminExceptionType;
import com.mallang.mallnagorder.admin.repository.AdminRepository;
import com.mallang.mallnagorder.ai.service.AdminPayloadService;
import com.mallang.mallnagorder.category.domain.Category;
import com.mallang.mallnagorder.category.dto.CategoryResponse;
import com.mallang.mallnagorder.category.exception.CategoryExceptionType;
import com.mallang.mallnagorder.category.exception.CategoryException;
import com.mallang.mallnagorder.category.repository.CategoryRepository;
import com.mallang.mallnagorder.category.repository.MenuCategoryRepository;
import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.menu.domain.MenuCategory;
import com.mallang.mallnagorder.menu.repository.MenuRepository;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final AdminRepository adminRepository;
    private final MenuCategoryRepository menuCategoryRepository; // 추가 필요
    private final AdminPayloadService adminPayloadService;

    @Transactional
    public CategoryResponse createCategory(String categoryName, String categoryNameEn, String categoryType, Long adminId) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));

        if (categoryRepository.existsByCategoryNameAndAdminId(categoryName, adminId)) {
            throw new CategoryException(CategoryExceptionType.ALREADY_EXIST_NAME);
        }
        if (categoryRepository.existsByCategoryNameEnAndAdminId(categoryNameEn, adminId)) {
            throw new CategoryException(CategoryExceptionType.ALREADY_EXIST_NAME_EN);
        }

        Category category = Category.builder()
                .categoryName(categoryName)
                .categoryNameEn(categoryNameEn)
                .categoryType(categoryType)
                .adminId(admin.getId())
                .build();

        Category saved = categoryRepository.save(category);
        adminPayloadService.generateAndForward(adminId);

        return toResponse(saved);
    }

    @Transactional
    public CategoryResponse updateCategory(Long adminId, Long categoryId, String newName, String newNameEn, String newCategoryType) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new CategoryException(CategoryExceptionType.CATEGORY_NOT_FOUND));

        if (categoryRepository.existsByCategoryNameAndAdminIdAndIdNot(newName, adminId, categoryId)) {
            throw new CategoryException(CategoryExceptionType.ALREADY_EXIST_NAME);
        }
        if (categoryRepository.existsByCategoryNameEnAndAdminIdAndIdNot(newNameEn, adminId, categoryId)) {
            throw new CategoryException(CategoryExceptionType.ALREADY_EXIST_NAME_EN);
        }

        category.setCategoryName(newName);
        category.setCategoryNameEn(newNameEn);
        category.setCategoryType(newCategoryType);

        adminPayloadService.generateAndForward(adminId);
        return toResponse(category);
    }

    private static final String DEFAULT_CATEGORY_NAME = "전체";

    @Transactional
    public void deleteCategory(Long adminId, Long categoryId) {
        Category category = categoryRepository.findByIdAndAdminId(categoryId, adminId)
                .orElseThrow(() -> new CategoryException(CategoryExceptionType.CATEGORY_NOT_FOUND));

        if (DEFAULT_CATEGORY_NAME.equals(category.getCategoryName())) {
            throw new CategoryException(CategoryExceptionType.CANNOT_DELETE_DEFAULT_CATEGORY);
        }

        // 메뉴-카테고리 연결 모두 삭제
        List<MenuCategory> menuCategories = menuCategoryRepository.findByIdCategoryId(categoryId);
        for (MenuCategory mc : menuCategories) {
            // 메뉴에서 menuCategory 제거
            Menu menu = mc.getMenu();
            menu.getMenuCategories().remove(mc);
            menuCategoryRepository.delete(mc);
        }

        categoryRepository.delete(category);
        adminPayloadService.generateAndForward(adminId);
    }

    private CategoryResponse toResponse(Category category) {
        return CategoryResponse.builder()
                .categoryId(category.getId())
                .categoryName(category.getCategoryName())
                .categoryNameEn(category.getCategoryNameEn())
                .categoryType(category.getCategoryType())
                .adminId(category.getAdminId())
                .build();
    }
}
