package com.mallang.mallnagorder.kiosk.controller;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/handwriting")
public class HandwritingController {
    private final HttpClient client;
    private final URI recognizeUrl;

    public HandwritingController(@Value("${HANDWRITING_SERVICE_URL:http://127.0.0.1:17832}") String serviceUrl) {
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        this.recognizeUrl = URI.create(serviceUrl.replaceAll("/+$", "") + "/recognize");
    }

    @PostMapping(value = "/recognize", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> recognize(@RequestBody JsonNode request) {
        var upstreamRequest = HttpRequest.newBuilder(recognizeUrl)
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(request.toString()))
                .build();

        try {
            var upstream = client.send(upstreamRequest, HttpResponse.BodyHandlers.ofString());
            return ResponseEntity.status(upstream.statusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(upstream.body());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return unavailable();
        } catch (IOException error) {
            return unavailable();
        }
    }

    private ResponseEntity<String> unavailable() {
        return ResponseEntity.status(503)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"error\":\"handwriting service unavailable\",\"candidates\":[]}");
    }
}
