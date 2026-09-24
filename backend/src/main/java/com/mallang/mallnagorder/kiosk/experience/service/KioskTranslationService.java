package com.mallang.mallnagorder.kiosk.experience.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.kiosk.experience.dto.ManagedShopDto;
import com.mallang.mallnagorder.kiosk.experience.dto.SearchTagDto;
import com.mallang.mallnagorder.translation.service.ArgosTranslatorService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;

@Service
public class KioskTranslationService {
    private final ArgosTranslatorService translator;
    private final Map<String, Map<String, String>> seeds;
    private final Set<String> seedNames;

    public KioskTranslationService(ArgosTranslatorService translator, ObjectMapper mapper) throws IOException {
        this.translator = translator;
        try (var stream = new ClassPathResource("translations/kiosk-seed.json").getInputStream()) {
            seeds = mapper.readValue(stream, new TypeReference<>() {});
        }
        try (var stream = new ClassPathResource("translations/kiosk-shop-names.json").getInputStream()) {
            seedNames = mapper.readValue(stream, new TypeReference<>() {});
        }
    }

    public Set<String> sources(List<ManagedShopDto> shops, List<SearchTagDto> tags) {
        Set<String> result = new LinkedHashSet<>(seeds.keySet());
        for (ManagedShopDto shop : shops) {
            add(result, shop.getName()); add(result, shop.getDescription()); add(result, shop.getKeywords());
            if (shop.getTags() != null) shop.getTags().forEach(text -> add(result, text));
        }
        for (SearchTagDto tag : tags) { add(result, tag.getName()); add(result, tag.getKeywords()); }
        return result;
    }

    private void add(Set<String> sources, String text) {
        if (text == null || text.isBlank()) return;
        sources.add(text.trim());
        // Index individual search terms as well as the full displayed text.
        if (text.contains(",")) Arrays.stream(text.split(",")).map(String::trim).filter(s -> !s.isEmpty()).forEach(sources::add);
    }

    public Map<String, Map<String, String>> withSeeds(Map<String, Map<String, String>> saved) {
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        seeds.forEach((source, value) -> result.put(source, new LinkedHashMap<>(value)));
        saved.forEach((source, value) -> {
            Map<String, String> target = result.computeIfAbsent(source, ignored -> new LinkedHashMap<>());
            value.forEach((language, text) -> {
                // Replace only the old floor transliterations created by our seed.
                if (source.matches(".*\\d+층.*") && text != null && text.matches(".*\\d+cheung.*")
                        && target.containsKey(language)) return;
                target.put(language, text);
            });
        });
        return result;
    }

    public List<String> missing(Set<String> sources, Map<String, Map<String, String>> translations) {
        return sources.stream().filter(source -> {
            Map<String, String> value = translations.getOrDefault(source, Map.of());
            return !hasText(value.get("en")) || !hasText(value.get("vi"));
        }).toList();
    }

    private boolean hasText(String text) { return text != null && !text.isBlank(); }

    public Map<String, Map<String, String>> translate(Set<String> sources, Map<String, Map<String, String>> saved) {
        return translate(sources, saved, List.of());
    }

    public Map<String, Map<String, String>> translate(Set<String> sources, Map<String, Map<String, String>> saved, List<ManagedShopDto> shops) {
        Set<String> names = new HashSet<>(seedNames);
        shops.stream().map(ManagedShopDto::getName).filter(Objects::nonNull).map(String::trim).forEach(names::add);
        var result = withSeeds(saved);
        translator.translateKioskTexts(missing(sources, result), names).forEach((source, value) ->
                result.computeIfAbsent(source, ignored -> new LinkedHashMap<>()).putAll(value));
        return result;
    }
}
