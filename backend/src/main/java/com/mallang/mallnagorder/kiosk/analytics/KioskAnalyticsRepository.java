package com.mallang.mallnagorder.kiosk.analytics;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.List;

public interface KioskAnalyticsRepository extends JpaRepository<KioskAnalyticsEvent, String> {
    List<KioskAnalyticsEvent> findByOccurredAtGreaterThanEqualAndOccurredAtLessThanOrderByOccurredAtAsc(Instant start, Instant end);
}
