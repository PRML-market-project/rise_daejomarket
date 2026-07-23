package com.mallang.mallnagorder.translation.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class AzureTranslatorService {

    private final RestClient restClient;
    private final String apiKey;
    private final String region;

    public AzureTranslatorService(
            RestClient.Builder restClientBuilder,
            @Value("${azure.translator.endpoint:https://api.cognitive.microsofttranslator.com}") String endpoint,
            @Value("${azure.translator.key:}") String apiKey,
            @Value("${azure.translator.region:}") String region
    ) {
        this.restClient = restClientBuilder.baseUrl(endpoint).build();
        this.apiKey = apiKey;
        this.region = region;
    }

    public Optional<String> translateToVietnamese(String koreanText) {
        return translate(koreanText, "ko");
    }

    public Optional<String> translateToVietnamese(String koreanText, String englishText) {
        if (StringUtils.hasText(englishText)) {
            return translate(englishText, "en");
        }
        return translateToVietnamese(koreanText);
    }

    private Optional<String> translate(String sourceText, String sourceLanguage) {
        if (!StringUtils.hasText(sourceText) || !StringUtils.hasText(apiKey)) {
            return Optional.empty();
        }

        try {
            JsonNode response = restClient.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/translate")
                            .queryParam("api-version", "3.0")
                            .queryParam("from", sourceLanguage)
                            .queryParam("to", "vi")
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Ocp-Apim-Subscription-Key", apiKey)
                    .headers(headers -> {
                        if (StringUtils.hasText(region)) {
                            headers.set("Ocp-Apim-Subscription-Region", region);
                        }
                    })
                    .body(List.of(Map.of("Text", sourceText.trim())))
                    .retrieve()
                    .body(JsonNode.class);

            String translated = response == null
                    ? null
                    : response.path(0).path("translations").path(0).path("text").asText(null);
            return StringUtils.hasText(translated)
                    ? Optional.of(translated.trim())
                    : Optional.empty();
        } catch (Exception e) {
            log.warn("Vietnamese translation failed for '{}': {}", sourceText, e.getMessage());
            return Optional.empty();
        }
    }

    public boolean isConfigured() {
        return StringUtils.hasText(apiKey);
    }
}
