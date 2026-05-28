package com.mallang.mallnagorder.order.repository;

import com.mallang.mallnagorder.kiosk.domain.Kiosk;
import com.mallang.mallnagorder.order.domain.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    void deleteByKiosk(Kiosk kiosk);
}
