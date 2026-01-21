package com.mallang.mallnagorder.menu.service;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.admin.exception.AdminException;
import com.mallang.mallnagorder.admin.exception.AdminExceptionType;
import com.mallang.mallnagorder.admin.repository.AdminRepository;
import com.mallang.mallnagorder.ai.service.AdminPayloadService;
import com.mallang.mallnagorder.category.domain.Category;
import com.mallang.mallnagorder.category.exception.CategoryException;
import com.mallang.mallnagorder.category.exception.CategoryExceptionType;
import com.mallang.mallnagorder.category.repository.CategoryRepository;
//import com.mallang.mallnagorder.global.util.S3Uploader;
import com.mallang.mallnagorder.global.util.LocalFileUploader;
import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.menu.domain.MenuCategory;
import com.mallang.mallnagorder.menu.domain.MenuCategoryId;
import com.mallang.mallnagorder.menu.dto.MenuRequest;
import com.mallang.mallnagorder.menu.dto.MenuResponse;
import com.mallang.mallnagorder.menu.exception.MenuException;
import com.mallang.mallnagorder.menu.exception.MenuExceptionType;
import com.mallang.mallnagorder.menu.repository.MenuRepository;
import com.mallang.mallnagorder.order.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MenuService {

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    private final CategoryRepository categoryRepository;
    private final AdminRepository adminRepository;
    private final MenuRepository menuRepository;
    private final OrderItemRepository orderItemRepository;
    private final LocalFileUploader localFileUploader;
    private final AdminPayloadService adminPayloadService;

    @Transactional
    public MenuResponse createMenu(Long adminId, MenuRequest request) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));

        if (menuRepository.existsByMenuNameAndAdminId(request.getMenuName(), adminId)) {
            throw new MenuException(MenuExceptionType.ALREADY_EXIST_NAME);
        }
        if (menuRepository.existsByMenuNameEnAndAdminId(request.getMenuNameEn(), adminId)) {
            throw new MenuException(MenuExceptionType.ALREADY_EXIST_NAME_EN);
        }

        String imageUrl = uploadImageOrDefault(request);

        // 1. 요청 카테고리 조회 - 반드시 DB에서 존재하는 카테고리만 추가 (id null 방지)
        Set<Category> categories = new LinkedHashSet<>();
        if (request.getCategoryIds() != null && !request.getCategoryIds().isEmpty()) {
            List<Category> foundCategories = categoryRepository.findAllById(request.getCategoryIds());
            if (foundCategories.size() != request.getCategoryIds().size()) {
                throw new CategoryException(CategoryExceptionType.CATEGORY_NOT_FOUND);
            }
            categories.addAll(foundCategories);
        }

        // 2. 기본 카테고리 추가 (DB에 무조건 존재하는 상태)
        Category defaultCategory = getOrCreateDefaultCategory(adminId);
        categories.add(defaultCategory);

        // 3. Menu 엔티티 생성 및 저장 (ID 확보)
        Menu menu = Menu.builder()
                .menuName(request.getMenuName())
                .menuNameEn(request.getMenuNameEn())
                .menuPrice(request.getMenuPrice())
                .menuCount(request.getMenuCount() != null ? request.getMenuCount() : "0")
                .imageUrl(imageUrl)
                .adminId(admin.getId())
                .visible(true)
                .build();

        Menu savedMenu = menuRepository.save(menu);

        // 4. MenuCategory 생성 및 연관관계 설정
        for (Category category : categories) {
            // 반드시 menu.getId(), category.getId() 모두 null 아님을 보장
            if (category.getId() == null) {
                throw new CategoryException(CategoryExceptionType.CATEGORY_NOT_FOUND);
            }

            // MenuCategory 중복 생성 방지: 이미 menuCategories에 존재하면 건너뜀
            boolean exists = savedMenu.getMenuCategories().stream()
                    .anyMatch(mc -> mc.getId().equals(new MenuCategoryId(savedMenu.getId(), category.getId())));
            if (!exists) {
                MenuCategory menuCategory = MenuCategory.of(savedMenu, category);
                savedMenu.addMenuCategory(menuCategory);
            }
        }

        adminPayloadService.generateAndForward(adminId);

        return toResponse(savedMenu);
    }

    @Transactional
    public MenuResponse updateMenu(Long adminId, Long menuId, MenuRequest request) {
        Menu menu = menuRepository.findByIdAndAdminId(menuId, adminId)
                .orElseThrow(() -> new MenuException(MenuExceptionType.MENU_NOT_FOUND));

        if (menuRepository.existsByMenuNameAndAdminIdAndIdNot(request.getMenuName(), adminId, menuId)) {
            throw new MenuException(MenuExceptionType.ALREADY_EXIST_NAME);
        }
        if (menuRepository.existsByMenuNameEnAndAdminIdAndIdNot(request.getMenuNameEn(), adminId, menuId)) {
            throw new MenuException(MenuExceptionType.ALREADY_EXIST_NAME_EN);
        }

        menu.setMenuName(request.getMenuName());
        menu.setMenuNameEn(request.getMenuNameEn());
        menu.setMenuPrice(request.getMenuPrice());
        if (request.getMenuCount() != null) {
            menu.setMenuCount(request.getMenuCount());
        }

        if (request.getImage() != null && !request.getImage().isEmpty()) {
            String imageUrl = uploadImageOrDefault(request);
            menu.setImageUrl(imageUrl);
        }

        // 1. 요청 카테고리 조회 및 기본카테고리 추가
        Set<Category> categories = new LinkedHashSet<>();
        if (request.getCategoryIds() != null && !request.getCategoryIds().isEmpty()) {
            List<Category> foundCategories = categoryRepository.findAllById(request.getCategoryIds());
            if (foundCategories.size() != request.getCategoryIds().size()) {
                throw new CategoryException(CategoryExceptionType.CATEGORY_NOT_FOUND);
            }
            categories.addAll(foundCategories);
        }
        Category defaultCategory = getOrCreateDefaultCategory(menu.getAdminId());
        categories.add(defaultCategory);

        // 2. 기존 menuCategories 중에서 현재 요청한 카테고리와 매칭되지 않는 항목 삭제
        menu.getMenuCategories().removeIf(mc -> !categories.contains(mc.getCategory()));

        // 3. 요청 카테고리에 없는 부분은 삭제됐으니, 요청 카테고리 중에 없는 부분만 새로 추가
        Set<Category> existingCategories = menu.getMenuCategories().stream()
                .map(MenuCategory::getCategory)
                .collect(Collectors.toSet());

        for (Category category : categories) {
            if (!existingCategories.contains(category)) {
                MenuCategory menuCategory = MenuCategory.of(menu, category);
                menu.addMenuCategory(menuCategory);
            }
        }

        Menu updatedMenu = menuRepository.save(menu);

        adminPayloadService.generateAndForward(adminId);

        return toResponse(updatedMenu);
    }

    //이미지 가져오기, 디폴트 이미지
    private String uploadImageOrDefault(MenuRequest request) {
        if (request.getImage() != null && !request.getImage().isEmpty()) {
            if (request.getImage().getSize() > MAX_FILE_SIZE) {
                throw new MenuException(MenuExceptionType.IMAGE_TOO_LARGE);
            }
            try {
                String relativePath = localFileUploader.upload(request.getImage(), "menu");
                //return "http://localhost:8080/images/" + relativePath;
                return "/images/" + relativePath;
            } catch (IOException e) {
                throw new RuntimeException("이미지 업로드 실패", e);
            }
        }
        return "/images/default/default-image.png";
    }

    private Category getOrCreateDefaultCategory(Long adminId) {
        return categoryRepository.findByCategoryNameAndAdminId("전체", adminId)
                .orElseGet(() -> categoryRepository.save(Category.builder()
                        .categoryName("전체")
                        .categoryNameEn("All")
                        .categoryType("DEFAULT")
                        .adminId(adminId)
                        .build()));
    }

    @Transactional
    public void deleteMenu(Long adminId, Long menuId) {
        Menu menu = menuRepository.findByIdAndAdminId(menuId, adminId)
                .orElseThrow(() -> new MenuException(MenuExceptionType.MENU_NOT_FOUND));

        boolean hasOrders = orderItemRepository.existsByMenuId(menu.getId());
        if (hasOrders) {
            throw new MenuException(MenuExceptionType.MENU_HAS_ORDER);
        }

        // TODO: 로컬 파일 삭제 로직 추가 필요
        // menu.getImageUrl()을 파싱해서 실제 로컬 파일을 찾아 삭제하는 로직을 추가할 수 있습니다.
        // File fileToDelete = new File(uploadDir + menu.getImageUrl().replace("/images/", ""));
        // if (fileToDelete.exists()) {
        //     fileToDelete.delete();
        // }

        menuRepository.delete(menu);

        // 예외 발생해도 삭제는 이미 완료된 상태이므로 필요시 별도 트랜잭션으로 분리도 고려 가능
        adminPayloadService.generateAndForward(adminId);
    }

    public MenuResponse toResponse(Menu menu) {
        return MenuResponse.builder()
                .menuId(menu.getId())
                .menuName(menu.getMenuName())
                .menuNameEn(menu.getMenuNameEn())
                .menuPrice(menu.getMenuPrice())
                .menuCount(menu.getMenuCount())
                .imageUrl(menu.getImageUrl())
                .adminId(menu.getAdminId())
                .categories(
                        menu.getMenuCategories().stream()
                                .map(menuCategory -> {
                                    Category category = menuCategory.getCategory();
                                    return MenuResponse.CategoryInfo.builder()
                                            .categoryId(category.getId())
                                            .categoryName(category.getCategoryName())
                                            .categoryNameEn(category.getCategoryNameEn())
                                            .build();
                                })
                                .toList()
                )
                .build();
    }

}