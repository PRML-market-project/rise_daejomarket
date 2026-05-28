package com.mallang.mallnagorder.order.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderResponse {
    private Long kioskId;
    private int kioskNumber;
    private boolean kioskIsActive;
    private List<OrderSummary> orders;

    @Getter
    @Builder
    public static class OrderSummary {
        private Long orderId;
        private String createdAt;
        private List<OrderItemSummary> items;
    }

    @Getter
    @Builder
    public static class OrderItemSummary {
        private String menuName;
        private String menuNameEn;
        private BigDecimal menuPrice;
        private int quantity;
    }
}
