package com.mallang.mallnagorder.translation.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import java.util.*;

@Slf4j
@Service
public class ArgosTranslatorService {
    private final RestClient client;
    private final boolean enabled;

    public ArgosTranslatorService(RestClient.Builder builder,
            @Value("${argos.translator.endpoint:http://127.0.0.1:17834}") String endpoint,
            @Value("${argos.translator.enabled:true}") boolean enabled) {
        this.client = builder.baseUrl(endpoint).build();
        this.enabled = enabled;
    }

    public boolean isConfigured() { return enabled; }

    public Optional<String> translateToVietnamese(String koreanText) {
        return translateOne(koreanText, "ko", "vi");
    }

    public Optional<String> translateToVietnamese(String koreanText, String englishText) {
        return StringUtils.hasText(englishText) ? translateOne(englishText, "en", "vi") : translateToVietnamese(koreanText);
    }

    private Optional<String> translateOne(String text, String source, String target) {
        if (!enabled || !StringUtils.hasText(text)) return Optional.empty();
        var result = request(List.of(text), source, List.of(target), Set.of());
        return Optional.ofNullable(result.getOrDefault(text, Map.of()).get(target));
    }

    public Map<String, Map<String, String>> translateKioskTexts(List<String> texts) {
        return translateKioskTexts(texts, Set.of());
    }

    public Map<String, Map<String, String>> translateKioskTexts(List<String> texts, Set<String> names) {
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        if (!enabled) return result;
        List<String> batch = new ArrayList<>();
        int characters = 0;
        for (String text : texts.stream().filter(StringUtils::hasText).distinct().toList()) {
            if (text.length() > 20000) continue;
            if (!batch.isEmpty() && (batch.size() >= 8 || characters + text.length() > 4000)) {
                var translated = request(batch, "ko", List.of("en", "vi"), names);
                result.putAll(translated);
                if (translated.size() != batch.size()) return result;
                batch.clear(); characters = 0;
            }
            batch.add(text); characters += text.length();
        }
        if (!batch.isEmpty()) result.putAll(request(batch, "ko", List.of("en", "vi"), names));
        return result;
    }

    private Map<String, Map<String, String>> request(List<String> texts, String source, List<String> targets, Set<String> names) {
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        try {
            JsonNode response = client.post().uri("/translate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("texts", texts, "source", source, "targets", targets, "nameTexts", texts.stream().filter(names::contains).toList()))
                    .retrieve().body(JsonNode.class);
            JsonNode rows = response == null ? null : response.path("results");
            if (rows == null || !rows.isArray() || rows.size() != texts.size()) return result;
            for (int i = 0; i < texts.size(); i++) {
                JsonNode row = rows.get(i);
                // Never associate a reordered or malformed response with the wrong shop.
                if (!texts.get(i).equals(row.path("sourceText").asText())) return Map.of();
                Map<String, String> languages = new LinkedHashMap<>();
                for (String target : targets) {
                    String value = row.path("translations").path(target).asText(null);
                    if (StringUtils.hasText(value)) languages.put(target, value.trim());
                }
                if (!languages.isEmpty()) result.put(texts.get(i), languages);
            }
        } catch (Exception e) {
            log.warn("Local Argos translation unavailable ({} texts); originals retained. {}", texts.size(), e.getClass().getSimpleName());
        }
        return result;
    }
}
