package com.mallang.mallnagorder.kiosk.analytics;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "kiosk_analytics_event", indexes = @Index(name = "idx_analytics_occurred", columnList = "occurredAt"))
@Getter @Setter @NoArgsConstructor
public class KioskAnalyticsEvent {
    @Id @Column(length = 36) private String id;
    @Version private Long version;
    @Column(nullable = false) private Instant occurredAt;
    @Column(nullable = false, length = 20) private String type;
    @Column(nullable = false, length = 36) private String sessionId;
    @Column(nullable = false, length = 20) private String source;
    @Column(nullable = false, length = 8) private String language;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT") private String targetsJson;
}
