package com.mallang.mallnagorder.kiosk.analytics;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import static org.springframework.format.annotation.DateTimeFormat.ISO.DATE;

@RestController
@RequestMapping("/api/kiosk-analytics")
@RequiredArgsConstructor
public class KioskAnalyticsController {
    private final KioskAnalyticsService service;
    private final KioskAnalyticsRepository repository;

    @PostMapping("/events")
    public ResponseEntity<Void> record(@RequestBody KioskAnalyticsService.EventRequest request) {
        try { service.record(request); }
        catch (DataIntegrityViolationException ex) {
            if (request.id() == null || !repository.existsById(request.id())) throw ex;
        }
        return ResponseEntity.noContent().build();
    }
    @GetMapping
    public KioskAnalyticsService.Summary summary(@RequestParam @DateTimeFormat(iso = DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate end, @RequestParam int year) {
        return service.summary(start, end, year);
    }
    @GetMapping(value = "/export", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<String> export(@RequestParam @DateTimeFormat(iso = DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DATE) LocalDate end, @RequestParam String kind) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"kiosk-" + kind + "-" + start + "-" + end + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).body(service.csv(start, end, kind));
    }
}
