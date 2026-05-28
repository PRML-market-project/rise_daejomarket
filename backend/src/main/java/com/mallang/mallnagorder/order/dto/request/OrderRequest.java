package com.mallang.mallnagorder.order.dto.request;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class OrderRequest {
    private Long kioskId;
    private List<OrderItemRequest> items;
}
