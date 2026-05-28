package com.mallang.mallnagorder.kiosk.controller;

import com.mallang.mallnagorder.category.dto.CategoryWithMenuResponse;
import com.mallang.mallnagorder.kiosk.service.KioskViewService;
import com.mallang.mallnagorder.order.dto.response.OrderResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/kiosk/{kioskId}")
@RequiredArgsConstructor
public class KioskViewController {

    private final KioskViewService kioskViewService;

    // 키오스크용 카테고리/메뉴 조회
    @GetMapping("/menu-by-category")
    public List<CategoryWithMenuResponse> getMenuByCategory(@PathVariable Long kioskId) {
        return kioskViewService.getCategoriesByKiosk(kioskId);
    }

    // 키오스크용 주문 조회
    @GetMapping("/orders")
    public OrderResponse getOrders(@PathVariable Long kioskId) {
        return kioskViewService.getOrdersByKiosk(kioskId);
    }
}
