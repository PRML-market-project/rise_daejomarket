package com.mallang.mallnagorder.translation.service;

import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class TranslatorHttpConfiguration {
    // ArgosTranslatorService is the application's RestClient consumer.
    // A failed remote service must not leave administrator saves waiting forever.
    @Bean
    RestClientCustomizer translatorTimeouts(@Value("${argos.translator.read-timeout-seconds:120}") long timeoutSeconds) {
        return builder -> {
            // Uvicorn serves HTTP/1.1; the JDK default HTTP/2 upgrade corrupts
            // translation POST requests and Argos rejects them with HTTP 422.
            var client = HttpClient.newBuilder()
                    .version(HttpClient.Version.HTTP_1_1)
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();
            var factory = new JdkClientHttpRequestFactory(client);
            factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
            builder.requestFactory(factory);
        };
    }
}
