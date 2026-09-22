package com.mallang.mallnagorder.kiosk.experience.service;

import com.mallang.mallnagorder.kiosk.experience.dto.KioskExperienceResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class KioskExperienceEventBroker {
    private static final long CONNECTION_TIMEOUT_MS = 30L * 60L * 1000L;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe(KioskExperienceResponse initialValue) {
        SseEmitter emitter = new SseEmitter(CONNECTION_TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        send(emitter, initialValue);
        return emitter;
    }

    public void publish(KioskExperienceResponse value) {
        emitters.forEach(emitter -> send(emitter, value));
    }

    private void send(SseEmitter emitter, KioskExperienceResponse value) {
        try {
            emitter.send(SseEmitter.event().name("experience").reconnectTime(1000).data(value));
        } catch (IOException | IllegalStateException error) {
            emitters.remove(emitter);
            emitter.complete();
        }
    }
}
