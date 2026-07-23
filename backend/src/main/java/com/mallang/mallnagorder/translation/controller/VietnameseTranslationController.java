package com.mallang.mallnagorder.translation.controller;

import com.mallang.mallnagorder.admin.dto.AdminDetails;
import com.mallang.mallnagorder.translation.dto.VietnameseBackfillResponse;
import com.mallang.mallnagorder.translation.service.VietnameseTranslationBackfillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/translations")
@RequiredArgsConstructor
public class VietnameseTranslationController {

    private final VietnameseTranslationBackfillService backfillService;

    @PostMapping("/vi/backfill")
    public ResponseEntity<VietnameseBackfillResponse> backfill(
            @AuthenticationPrincipal AdminDetails adminDetails
    ) {
        return ResponseEntity.ok(
                backfillService.backfill(adminDetails.getAdmin().getId())
        );
    }
}
