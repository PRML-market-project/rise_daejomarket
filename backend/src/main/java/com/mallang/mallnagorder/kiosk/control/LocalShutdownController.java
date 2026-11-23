package com.mallang.mallnagorder.kiosk.control;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/kiosk-control")
public class LocalShutdownController {
    private static final Set<String> LOOPBACK = Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1");
    private final LocalShutdownService service;
    public LocalShutdownController(LocalShutdownService service) { this.service = service; }

    @PostMapping("/shutdown")
    public ResponseEntity<Map<String, String>> shutdown(HttpServletRequest request) {
        if (!allowed(request)) return ResponseEntity.status(403).body(Map.of("message", "종료는 키오스크 PC의 로컬 어드민에서만 가능합니다."));
        try {
            service.shutdown();
            return ResponseEntity.accepted().body(Map.of("status", "stopping", "message", "키오스크의 모든 서비스를 종료합니다."));
        } catch (UnsupportedOperationException error) {
            return ResponseEntity.status(503).body(Map.of("message", error.getMessage()));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return unavailable();
        } catch (IOException error) {
            return unavailable();
        }
    }

    private ResponseEntity<Map<String, String>> unavailable() {
        return ResponseEntity.status(503).body(Map.of("message", "종료 요청을 처리하지 못했습니다. 다시 시도하거나 end.cmd를 실행해주세요."));
    }

    static boolean allowed(HttpServletRequest request) {
        if (!LOOPBACK.contains(request.getRemoteAddr()) || !"admin-header".equals(request.getHeader("X-Kiosk-Control"))) return false;
        // A quick tunnel also reaches the server on loopback. Refuse all forwarded requests,
        // and require a local browser origin so a different website cannot trigger shutdown.
        if (Collections.list(request.getHeaderNames()).stream().map(String::toLowerCase)
                .anyMatch(name -> name.startsWith("x-forwarded-") || Set.of("forwarded", "cf-connecting-ip", "true-client-ip").contains(name))) return false;
        try {
            URI origin = URI.create(request.getHeader("Origin"));
            return Set.of("http", "https").contains(origin.getScheme())
                    && Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(origin.getHost())
                    && Set.of(5173, 3000).contains(origin.getPort())
                    && origin.getRawUserInfo() == null && origin.getRawQuery() == null && origin.getRawFragment() == null
                    && (origin.getRawPath() == null || origin.getRawPath().isEmpty());
        } catch (IllegalArgumentException | NullPointerException error) { return false; }
    }
}
