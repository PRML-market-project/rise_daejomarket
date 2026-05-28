package com.mallang.mallnagorder.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.ai.dto.AdminPayloadDto;
import com.mallang.mallnagorder.category.repository.CategoryRepository;
import com.mallang.mallnagorder.category.domain.Category;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminPayloadService {

    private final CategoryRepository categoryRepository;
    private final ObjectMapper objectMapper;
    private final AdminPayloadForwardService forwardService;

    private static final String PAYLOAD_DIRECTORY = "src/main/resources/payload/";

    public void generateAndForward(Long adminId) {
        List<Category> categories = categoryRepository.findAllWithMenusByAdminId(adminId);
        AdminPayloadDto dto = AdminPayloadDto.from(adminId, categories);

        try {
            File jsonFile = writePayloadToJsonFile(dto, adminId);
            forwardService.forwardSingleFileToAiServer(jsonFile);
        } catch (IOException e) {
            log.error("Failed to write or forward payload for adminId: {}", adminId, e);
        }
    }

    private File writePayloadToJsonFile(AdminPayloadDto dto, Long adminId) throws IOException {
        File directory = new File(PAYLOAD_DIRECTORY);
        if (!directory.exists()) directory.mkdirs();

        File jsonFile = new File(PAYLOAD_DIRECTORY + adminId + ".json");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(jsonFile, dto);
        return jsonFile;
    }

    public void generateAllPayloadsAndForward() {
        List<Long> allAdminIds = categoryRepository.findAllAdminIds(); // 🔸 커스텀 쿼리 필요
        for (Long adminId : allAdminIds) {
            List<Category> categories = categoryRepository.findAllWithMenusByAdminId(adminId);
            AdminPayloadDto dto = AdminPayloadDto.from(adminId, categories);
            try {
                writePayloadToJsonFile(dto, adminId);
            } catch (IOException e) {
                log.error("Failed to write payload for adminId: {}", adminId, e);
            }
        }

        forwardService.forwardAllFilesInPayloadDirectory();
    }

}
