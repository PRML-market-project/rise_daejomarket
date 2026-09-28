package com.mallang.mallnagorder.kiosk.experience.service;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class KioskExperienceWebSocketConfig implements WebSocketConfigurer {
    private final KioskExperienceWebSocketHandler handler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/api/kiosk-experience/live")
                .setAllowedOrigins(
                        "https://rise-daejomarket.vercel.app",
                        "https://prmlfrontend.vercel.app",
                        "http://localhost:5173",
                        "http://127.0.0.1:5173");
    }
}
