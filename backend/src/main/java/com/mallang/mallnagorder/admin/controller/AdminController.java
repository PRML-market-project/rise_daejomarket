package com.mallang.mallnagorder.admin.controller;

import com.mallang.mallnagorder.admin.dto.*;
import com.mallang.mallnagorder.admin.exception.AdminException;
import com.mallang.mallnagorder.admin.service.AdminService;
import com.mallang.mallnagorder.admin.service.EmailAuthService;
import com.mallang.mallnagorder.category.dto.CategoryResponse;
import com.mallang.mallnagorder.menu.dto.MenuResponse;
import com.mallang.mallnagorder.order.dto.response.OrderResponse;
import jakarta.mail.MessagingException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.UnsupportedEncodingException;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final EmailAuthService emailAuthService;

    public AdminController(AdminService adminService, EmailAuthService emailAuthService) {
        this.adminService = adminService;
        this.emailAuthService = emailAuthService;
    }

    // 테스트 완료
    @PostMapping("/emailSend")
    public ResponseEntity<CheckResponse> emailSend(@RequestBody EmailCheckRequest request) throws MessagingException, UnsupportedEncodingException {
        adminService.emailValidate(request);
        String authNum = emailAuthService.sendAuthNumber(request.getEmail());
        log.info("이메일 인증번호 발송: {}", authNum);

        return ResponseEntity.ok(new CheckResponse(true, "이메일 인증번호가 발송되었습니다. 인증을 진행해주세요."));
    }


    // 테스트 완료
    @PostMapping("/emailCheck")
    public ResponseEntity<EmailCheckResponse> emailCheck(@RequestBody EmailCheckRequest request) {
        log.info("이메일 인증 요청 - 이메일: {}, 인증번호: {}", request.getEmail(), request.getAuthNum());

        boolean isValid = emailAuthService.validateAuthNumber(request.getEmail(), request.getAuthNum());

        if (isValid) {
            return new ResponseEntity<>(new EmailCheckResponse(true, "이메일 인증 성공"), HttpStatus.OK);
        } else {
            return new ResponseEntity<>(new EmailCheckResponse(false, "인증번호가 잘못되었습니다."), HttpStatus.BAD_REQUEST);
        }
    }

    // 테스트 완료
    @PostMapping("/join")
    public ResponseEntity<Long> addMember(@RequestBody JoinRequest request) {
        Long savedAdminId = adminService.join(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedAdminId);
    }

    // 관리자 이름 변경
    @PatchMapping("/change-admin-name")
    public ResponseEntity<CheckResponse> changeAdminName(@AuthenticationPrincipal AdminDetails adminDetails,
                                                         @RequestBody ChangeNameRequest request) {
        String email = adminDetails.getUsername();
        CheckResponse response = adminService.changeAdminName(email, request.getNewName());
        return new ResponseEntity<>(response, response.isSuccess() ? HttpStatus.OK : HttpStatus.NOT_FOUND);
    }

    // 테스트 완료
    @PatchMapping("/change-store-name")
    public ResponseEntity<CheckResponse> changeStoreName(@AuthenticationPrincipal AdminDetails adminDetails,
                                                         @RequestBody ChangeNameRequest request) {
        String email = adminDetails.getUsername();
        CheckResponse response = adminService.changeStoreName(email, request.getNewName(), request.getNewNameEn());
        return new ResponseEntity<>(response, response.isSuccess() ? HttpStatus.OK : HttpStatus.NOT_FOUND);
    }

    // 비밀번호 변경
    @PatchMapping("/change-password")
    public ResponseEntity<CheckResponse> changePassword(@AuthenticationPrincipal AdminDetails adminDetails,
                                                        @RequestBody ChangePasswordRequest request) {
        String email = adminDetails.getUsername();
        try {
            CheckResponse response = adminService.changePassword(email, request.getOldPassword(), request.getNewPassword());
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (AdminException e) {
            return new ResponseEntity<>(new CheckResponse(false, e.getMessage()), e.getExceptionType().getHttpStatus());
        }
    }

    // 회원탈퇴
    @DeleteMapping("/delete-admin")
    public ResponseEntity<CheckResponse> deleteMember(@AuthenticationPrincipal AdminDetails adminDetails,
                                                      @RequestBody DeleteRequest request) {
        String email = adminDetails.getUsername();
        try {
            CheckResponse response = adminService.deleteAdmin(email, request.getPassword());
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (AdminException e) {
            return new ResponseEntity<>(new CheckResponse(false, e.getMessage()), e.getExceptionType().getHttpStatus());
        }
    }

    // 테스트 완료
    @PostMapping("/checkStoreName")
    public ResponseEntity<CheckResponse> checkStoreName(@RequestBody StoreNameRequest request) {
        CheckResponse response = adminService.checkStoreName(request.getStoreName(), request.getStoreNameEn());
        return new ResponseEntity<>(response, response.isSuccess() ? HttpStatus.OK : HttpStatus.CONFLICT);
    }

    // 가게 정보 반환 - 테스트 완료
    @GetMapping("/store-info")
    public ResponseEntity<StoreInfoResponse> getStoreInfo(@AuthenticationPrincipal AdminDetails adminDetails) {
        StoreInfoResponse response = adminService.getStoreInfo(adminDetails.getAdmin().getId());
        return ResponseEntity.ok(response);
    }

    // 카테고리 조회
    @GetMapping("/categories")
    public ResponseEntity<List<CategoryResponse>> getCategories(@AuthenticationPrincipal AdminDetails adminDetails) {
        return ResponseEntity.ok(adminService.getCategories(adminDetails.getAdmin().getId()));
    }

    // 메뉴 조회
    @GetMapping("/menus")
    public ResponseEntity<List<MenuResponse>> getMenus(@AuthenticationPrincipal AdminDetails adminDetails) {
        return ResponseEntity.ok(adminService.getMenus(adminDetails.getAdmin().getId()));
    }

    // 주문 조회
    @GetMapping("/orders")
    public ResponseEntity<List<OrderResponse>> getOrders(@AuthenticationPrincipal AdminDetails adminDetails) {
        return ResponseEntity.ok(adminService.getOrders(adminDetails.getAdmin().getId()));
    }
}
