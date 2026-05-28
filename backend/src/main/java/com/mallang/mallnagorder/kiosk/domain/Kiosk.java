package com.mallang.mallnagorder.kiosk.domain;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.global.entity.BaseEntity;
import com.mallang.mallnagorder.order.domain.Order;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Kiosk extends BaseEntity {

    @Column(nullable = false, length = 100)
    private Integer kioskNumber;

    @Column(nullable = false)
    private Boolean isActive;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    private Admin admin;

    @OneToMany(mappedBy = "kiosk", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

}
