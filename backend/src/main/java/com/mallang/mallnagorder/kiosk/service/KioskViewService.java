package com.mallang.mallnagorder.kiosk.service;

import com.mallang.mallnagorder.category.dto.CategoryWithMenuResponse;
import com.mallang.mallnagorder.category.repository.CategoryRepository;
import com.mallang.mallnagorder.kiosk.domain.Kiosk;
import com.mallang.mallnagorder.kiosk.exception.KioskException;
import com.mallang.mallnagorder.kiosk.exception.KioskExceptionType;
import com.mallang.mallnagorder.kiosk.repository.KioskRepository;
import com.mallang.mallnagorder.order.domain.Order;
import com.mallang.mallnagorder.order.dto.response.OrderResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KioskViewService {

    private final KioskRepository kioskRepository;
    private final CategoryRepository categoryRepository;

    public List<CategoryWithMenuResponse> getCategoriesByKiosk(Long kioskId) {
        Kiosk kiosk = kioskRepository.findById(kioskId)
                .orElseThrow(() -> new KioskException(KioskExceptionType.KIOSK_NOT_FOUND));

        Long adminId = kiosk.getAdmin().getId(); // admin 전체를 쓰지 않고 ID만 추출

        return categoryRepository.findAllWithMenusByAdminId(adminId).stream()
                .map(CategoryWithMenuResponse::from)
                .toList();
    }

    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public OrderResponse getOrdersByKiosk(Long kioskId) {
        Kiosk kiosk = kioskRepository.findById(kioskId)
                .orElseThrow(() -> new KioskException(KioskExceptionType.KIOSK_NOT_FOUND));

        List<Order> orders = kiosk.getOrders();

        List<OrderResponse.OrderSummary> orderSummaries = orders.stream()
                .map(order -> OrderResponse.OrderSummary.builder()
                        .orderId(order.getId())
                        .createdAt(order.getCreatedDate().format(formatter))
                        .items(order.getOrderItems().stream()
                                .map(item -> OrderResponse.OrderItemSummary.builder()
                                        .menuName(item.getMenu().getMenuName())
                                        .menuNameEn(item.getMenu().getMenuNameEn())
                                        .menuPrice(item.getMenu().getMenuPrice())
                                        .quantity(item.getQuantity())
                                        .build())
                                .toList())
                        .build())
                .toList();

        return OrderResponse.builder()
                .kioskId(kioskId)
                .kioskNumber(kiosk.getKioskNumber()) // ← 여기서 바로 가져옴
                .kioskIsActive(kiosk.getIsActive())
                .orders(orderSummaries) // 주문 없으면 빈 배열
                .build();
    }


}
