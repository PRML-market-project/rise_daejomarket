package com.mallang.mallnagorder.kiosk.experience.service;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class KioskExperienceWebSocketHandler extends TextWebSocketHandler {
    private static final TextMessage CHANGED = new TextMessage("changed");
    private final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        send(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    public void publish() {
        sessions.forEach(this::send);
    }

    private void send(WebSocketSession session) {
        try {
            synchronized (session) {
                if (session.isOpen()) session.sendMessage(CHANGED);
                else sessions.remove(session);
            }
        } catch (IOException | IllegalStateException error) {
            sessions.remove(session);
            try { session.close(); } catch (IOException ignored) { }
        }
    }
}
