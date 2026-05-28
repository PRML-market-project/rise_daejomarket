package com.mallang.mallnagorder.order.repository;

import com.mallang.mallnagorder.order.domain.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    // 메뉴 ID로 주문 항목 존재 여부 확인
    boolean existsByMenuId(Long menuId);
}
