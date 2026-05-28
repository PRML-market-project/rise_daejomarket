package com.mallang.mallnagorder.kiosk.controller;

import com.mallang.mallnagorder.admin.dto.AdminDetails;
import com.mallang.mallnagorder.admin.dto.CheckResponse;
import com.mallang.mallnagorder.kiosk.dto.ActivateKioskRequest;
import com.mallang.mallnagorder.kiosk.dto.ActivateKioskResponse;
import com.mallang.mallnagorder.kiosk.dto.DeactiveKioskRequest;
import com.mallang.mallnagorder.kiosk.dto.KioskCountRequest;
import com.mallang.mallnagorder.kiosk.service.KioskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/kiosk")
@RequiredArgsConstructor
public class KioskController {

    private final KioskService kioskService;

    // 키오스크 세팅
    @PostMapping("/set")
    public ResponseEntity<CheckResponse> setKiosks(
            @AuthenticationPrincipal AdminDetails adminDetails,
            @RequestBody KioskCountRequest request) {

        kioskService.setKiosks(adminDetails.getAdmin(), request.getCount());
        return ResponseEntity.ok(new CheckResponse(true, "테이블 정보가 성공적으로 설정되었습니다."));
    }

    // 키오스크 활성화
    @PostMapping("/activate")
    public ResponseEntity<ActivateKioskResponse> activateKiosk(
            @RequestBody ActivateKioskRequest request) {
        ActivateKioskResponse response = kioskService.activateKioskByStoreNameAndNumber(
                request.getStoreName(), request.getKioskNumber());
        return ResponseEntity.ok(response);
    }

    // 키오스크 비활성화
    @PostMapping("/deactivate")
    public ResponseEntity<CheckResponse> deactivateKiosk(@RequestBody DeactiveKioskRequest request) {
        int kioskNumber = kioskService.deactivateKioskByNumber(request.getKioskId());
        String message = kioskNumber + "번 테이블이 비활성화 처리되었습니다.";
        return ResponseEntity.ok(new CheckResponse(true, message));
    }

}
