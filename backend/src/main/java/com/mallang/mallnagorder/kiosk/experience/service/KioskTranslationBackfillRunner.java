package com.mallang.mallnagorder.kiosk.experience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "argos.translator.kiosk-backfill-on-startup", havingValue = "true", matchIfMissing = true)
public class KioskTranslationBackfillRunner implements ApplicationRunner {
    private final KioskExperienceService service;
    private final KioskExperienceEventBroker events;

    @Override
    public void run(ApplicationArguments args) {
        var result = service.backfillTranslations();
        events.publish(result);
        log.info("Kiosk English/Vietnamese translations loaded; {} texts pending", result.getPendingTranslations());
    }
}
