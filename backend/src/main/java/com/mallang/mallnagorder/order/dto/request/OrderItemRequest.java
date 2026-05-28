package com.mallang.mallnagorder.order.dto.request;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class OrderItemRequest {
    private Long menuId;
    private Integer quantity;
}
