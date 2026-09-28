package com.mallang.mallnagorder.kiosk.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class HandwritingControllerTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void forwardsRecognitionRequestThroughBackend() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var forwardedBody = new AtomicReference<String>();
        server.createContext("/recognize", exchange -> {
            forwardedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            var response = "{\"candidates\":[\"김치\"]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) {
                output.write(response);
            }
        });
        server.start();
        try {
            var controller = new HandwritingController("http://127.0.0.1:" + server.getAddress().getPort());
            var mvc = MockMvcBuilders.standaloneSetup(controller).build();
            var request = "{\"language\":\"ko\",\"strokes\":[{\"points\":[{\"x\":1,\"y\":2},{\"x\":3,\"y\":4}]}]}";

            mvc.perform(post("/api/handwriting/recognize")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(request))
                    .andExpect(status().isOk())
                    .andExpect(content().json("{\"candidates\":[\"김치\"]}"));

            assertThat(mapper.readTree(forwardedBody.get())).isEqualTo(mapper.readTree(request));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void returnsServiceUnavailableWhenRecognizerIsOffline() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        int port = server.getAddress().getPort();
        server.stop(0);
        var controller = new HandwritingController("http://127.0.0.1:" + port);
        var mvc = MockMvcBuilders.standaloneSetup(controller).build();

        mvc.perform(post("/api/handwriting/recognize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"language\":\"ko\",\"strokes\":[]}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().json("{\"error\":\"handwriting service unavailable\",\"candidates\":[]}"));
    }
}
