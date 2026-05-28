package com.mallang.mallnagorder.menu.controller;

import com.mallang.mallnagorder.admin.dto.AdminDetails;
import com.mallang.mallnagorder.menu.dto.MenuRequest;
import com.mallang.mallnagorder.menu.dto.MenuResponse;
import com.mallang.mallnagorder.menu.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/menu")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;

    // 메뉴 생성 - 테스트 완료
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<MenuResponse> createMenu(
            @AuthenticationPrincipal AdminDetails adminDetails,
            @ModelAttribute MenuRequest request
    ) {
        MenuResponse response = menuService.createMenu(adminDetails.getAdmin().getId(), request);
        return ResponseEntity.status(201).body(response);
    }

    // 메뉴 수정 - 테스트 완료
    @PutMapping(value = "/{menuId}", consumes = "multipart/form-data")
    public ResponseEntity<MenuResponse> updateMenu(
            @AuthenticationPrincipal AdminDetails adminDetails,
            @PathVariable Long menuId,
            @ModelAttribute MenuRequest request
    ) {
        MenuResponse response = menuService.updateMenu(adminDetails.getAdmin().getId(), menuId, request);
        return ResponseEntity.ok(response);
    }

    // 메뉴 삭제 - 테스트 완료
    @DeleteMapping("/{menuId}")
    public ResponseEntity<Void> deleteMenu(@AuthenticationPrincipal AdminDetails adminDetails,
                                           @PathVariable Long menuId) {
        menuService.deleteMenu(adminDetails.getAdmin().getId(), menuId);
        return ResponseEntity.noContent().build(); // 204 No Content
    }
}
