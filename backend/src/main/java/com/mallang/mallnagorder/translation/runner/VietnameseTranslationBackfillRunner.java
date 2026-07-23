package com.mallang.mallnagorder.translation.runner;

import com.mallang.mallnagorder.admin.repository.AdminRepository;
import com.mallang.mallnagorder.translation.dto.VietnameseBackfillResponse;
import com.mallang.mallnagorder.translation.service.VietnameseTranslationBackfillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = "azure.translator.backfill-on-startup",
        havingValue = "true"
)
public class VietnameseTranslationBackfillRunner implements ApplicationRunner {

    private final AdminRepository adminRepository;
    private final VietnameseTranslationBackfillService backfillService;

    @Override
    public void run(ApplicationArguments args) {
        int storesUpdated = 0;
        int categoriesUpdated = 0;
        int menusUpdated = 0;

        for (Long adminId : adminRepository.findAllAdminIds()) {
            VietnameseBackfillResponse result = backfillService.backfill(adminId, true);
            storesUpdated += result.storesUpdated();
            categoriesUpdated += result.categoriesUpdated();
            menusUpdated += result.menusUpdated();
        }

        log.info(
                "Vietnamese backfill completed: stores={}, categories={}, menus={}",
                storesUpdated,
                categoriesUpdated,
                menusUpdated
        );
    }
}
