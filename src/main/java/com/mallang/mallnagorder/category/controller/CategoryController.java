package com.mallang.mallnagorder.category.controller;

import com.mallang.mallnagorder.admin.dto.AdminDetails;
import com.mallang.mallnagorder.category.dto.CategoryRequest;
import com.mallang.mallnagorder.category.dto.CategoryResponse;
import com.mallang.mallnagorder.category.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/category")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    // 카테고리 생성 - 테스트 완료
    @PostMapping
    public ResponseEntity<CategoryResponse> createCategory(@AuthenticationPrincipal AdminDetails adminDetails,
                                                           @RequestBody CategoryRequest request) {
        CategoryResponse response = categoryService.createCategory(request.getCategoryName(), request.getCategoryNameEn(), request.getCategoryType(), adminDetails.getAdmin().getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 카테고리 이름 수정 - 테스트 완료
    @PutMapping("/{categoryId}")
    public ResponseEntity<CategoryResponse> updateCategory(@AuthenticationPrincipal AdminDetails adminDetails,
                                                           @PathVariable Long categoryId,
                                                           @RequestBody CategoryRequest request) {
        CategoryResponse response = categoryService.updateCategory(adminDetails.getAdmin().getId(), categoryId, request.getCategoryName(), request.getCategoryNameEn(), request.getCategoryType());
        return ResponseEntity.ok(response);
    }

    // 카테고리 삭제 - 테스트 완료
    @DeleteMapping("/{categoryId}")
    public ResponseEntity<Void> deleteCategory(@AuthenticationPrincipal AdminDetails adminDetails,
                                                @PathVariable Long categoryId) {
        categoryService.deleteCategory(adminDetails.getAdmin().getId(), categoryId);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build(); // 204 No Content 응답
    }


}
