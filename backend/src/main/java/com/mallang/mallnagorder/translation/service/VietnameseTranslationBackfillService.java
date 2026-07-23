package com.mallang.mallnagorder.translation.service;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.admin.exception.AdminException;
import com.mallang.mallnagorder.admin.exception.AdminExceptionType;
import com.mallang.mallnagorder.admin.repository.AdminRepository;
import com.mallang.mallnagorder.ai.service.AdminPayloadService;
import com.mallang.mallnagorder.category.domain.Category;
import com.mallang.mallnagorder.category.repository.CategoryRepository;
import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.menu.repository.MenuRepository;
import com.mallang.mallnagorder.translation.dto.VietnameseBackfillResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VietnameseTranslationBackfillService {

    private final AzureTranslatorService translatorService;
    private final VietnameseMenuCountTranslator menuCountTranslator;
    private final AdminRepository adminRepository;
    private final CategoryRepository categoryRepository;
    private final MenuRepository menuRepository;
    private final AdminPayloadService adminPayloadService;

    @Transactional
    public VietnameseBackfillResponse backfill(Long adminId) {
        return backfill(adminId, false);
    }

    @Transactional
    public VietnameseBackfillResponse backfill(Long adminId, boolean overwriteExisting) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));

        int storesUpdated = 0;
        int categoriesUpdated = 0;
        int menusUpdated = 0;

        if (overwriteExisting || !StringUtils.hasText(admin.getStoreNameVi())) {
            String translated = translatorService.translateToVietnamese(
                    admin.getStoreName(),
                    admin.getStoreNameEn()
            ).orElse(null);
            if (StringUtils.hasText(translated)) {
                admin.setStoreNameVi(translated);
                storesUpdated++;
            }
        }

        List<Category> categories = categoryRepository.findByAdminId(adminId);
        for (Category category : categories) {
            if (overwriteExisting || !StringUtils.hasText(category.getCategoryNameVi())) {
                String translated = translatorService.translateToVietnamese(
                        category.getCategoryName(),
                        category.getCategoryNameEn()
                ).orElse(null);
                if (StringUtils.hasText(translated)) {
                    category.setCategoryNameVi(translated);
                    categoriesUpdated++;
                }
            }
        }

        List<Menu> menus = menuRepository.findByAdminId(adminId);
        for (Menu menu : menus) {
            boolean menuUpdated = false;
            if (overwriteExisting || !StringUtils.hasText(menu.getMenuNameVi())) {
                String translated = translatorService.translateToVietnamese(
                        menu.getMenuName(),
                        menu.getMenuNameEn()
                ).orElse(null);
                if (StringUtils.hasText(translated)) {
                    menu.setMenuNameVi(translated);
                    menuUpdated = true;
                }
            }
            if (overwriteExisting || !StringUtils.hasText(menu.getMenuCountVi())) {
                String translated = menuCountTranslator.translate(
                                menu.getMenuCount(),
                                menu.getMenuNameEn()
                        )
                        .orElse(null);
                if (StringUtils.hasText(translated)) {
                    menu.setMenuCountVi(translated);
                    menuUpdated = true;
                }
            }
            if (menuUpdated) {
                menusUpdated++;
            }
        }

        if (storesUpdated + categoriesUpdated + menusUpdated > 0) {
            adminPayloadService.generateAndForward(adminId);
        }

        return new VietnameseBackfillResponse(
                translatorService.isConfigured(),
                storesUpdated,
                categoriesUpdated,
                menusUpdated
        );
    }
}
