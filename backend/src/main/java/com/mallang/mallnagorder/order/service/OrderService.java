package com.mallang.mallnagorder.order.service;

import com.mallang.mallnagorder.kiosk.domain.Kiosk;
import com.mallang.mallnagorder.kiosk.exception.KioskException;
import com.mallang.mallnagorder.kiosk.exception.KioskExceptionType;
import com.mallang.mallnagorder.kiosk.repository.KioskRepository;
import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.menu.exception.MenuException;
import com.mallang.mallnagorder.menu.exception.MenuExceptionType;
import com.mallang.mallnagorder.menu.repository.MenuRepository;
import com.mallang.mallnagorder.order.domain.Order;
import com.mallang.mallnagorder.order.domain.OrderItem;
import com.mallang.mallnagorder.order.dto.request.OrderItemRequest;
import com.mallang.mallnagorder.order.dto.request.OrderRequest;
import com.mallang.mallnagorder.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    private final KioskRepository kioskRepository;
    private final MenuRepository menuRepository;

    // 주문 생성
    @Transactional
    public void createOrder(OrderRequest request) {
        // 1. 키오스크 조회
        Kiosk kiosk = kioskRepository.findById(request.getKioskId())
                .orElseThrow(() -> new KioskException(KioskExceptionType.KIOSK_NOT_FOUND));

        // 2. 주문 아이템 처리 및 총합 계산
        BigDecimal totalPrice = BigDecimal.ZERO;
        List<OrderItem> orderItems = new ArrayList<>();

        for (OrderItemRequest itemRequest : request.getItems()) {
            Menu menu = menuRepository.findById(itemRequest.getMenuId())
                    .orElseThrow(() -> new MenuException(MenuExceptionType.MENU_NOT_FOUND));

            OrderItem orderItem = OrderItem.builder()
                    .menu(menu)
                    .quantity(itemRequest.getQuantity())
                    .build();

            orderItems.add(orderItem);
            totalPrice = totalPrice.add(menu.getMenuPrice().multiply(BigDecimal.valueOf(itemRequest.getQuantity())));
        }

        // 3. Order 생성 및 연관 설정
        Order order = Order.builder()
                .kiosk(kiosk)
                .isCompleted(false)
                .totalPrice(totalPrice)
                .build();

        // 4. OrderItem 연관 설정
        for (OrderItem item : orderItems) {
            item.setOrder(order);
        }
        order.setOrderItems(orderItems);

        // 5. 저장 (Cascade.ALL 설정으로 OrderItem도 자동 저장)
        orderRepository.save(order);
    }

    // 주문 삭제
    @Transactional
    public void deleteOrdersByKiosk(Long adminId, int kioskNumber) {
        // 관리자 본인의 키오스크인지 확인
        Kiosk kiosk = kioskRepository.findByAdminIdAndKioskNumber(adminId, kioskNumber)
                .orElseThrow(() -> new KioskException(KioskExceptionType.KIOSK_NOT_FOUND));

        // 해당 키오스크에 연관된 주문을 모두 삭제
        orderRepository.deleteByKiosk(kiosk);
    }
}
