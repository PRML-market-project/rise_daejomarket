package com.mallang.mallnagorder.ai.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.File;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminPayloadForwardService {

    @Value("${payload.forward.url:http://localhost:8000/upload_jsons}")
    private String forwardUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public void forwardSingleFileToAiServer(File file) {
        if (file == null || !file.exists()) {
            log.warn("File does not exist: {}", file);
            return;
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("files", new FileSystemResource(file)); // ✅ 단일 파일 key는 "file"

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(forwardUrl, request, String.class);
            log.info("AI 서버 응답: {}", response.getStatusCode());
        } catch (Exception e) {
            log.error("AI 서버 전송 실패", e);
        }
    }

    public void forwardAllFilesInPayloadDirectory() {
        File directory = new File("src/main/resources/payload/");
        if (!directory.exists() || !directory.isDirectory()) {
            log.warn("Payload directory not found.");
            return;
        }

        File[] jsonFiles = directory.listFiles((dir, name) -> name.endsWith(".json"));
        if (jsonFiles == null || jsonFiles.length == 0) {
            log.warn("No payload files found to forward.");
            return;
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        for (File file : jsonFiles) {
            body.add("files", new FileSystemResource(file)); // 🔸 key는 동일한 "files"
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(forwardUrl, request, String.class);
            log.info("AI 서버 응답 (전체 전송): {}", response.getStatusCode());
        } catch (Exception e) {
            log.error("AI 서버로 전체 파일 전송 실패", e);
        }
    }

}
