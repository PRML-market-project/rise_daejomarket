package com.mallang.mallnagorder.global.util; // 패키지 경로는 그대로 둡니다.

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class LocalFileUploader {

    @Value("${file.upload-dir}")
    private String uploadDir;

    public String upload(MultipartFile multipartFile, String dirName) throws IOException {
        if (multipartFile.isEmpty()) {
            return null;
        }

        // 전체 저장 경로 (C:/project-uploads/ + items/ 등)
        File uploadPath = new File(uploadDir, dirName);

        // 하위 디렉토리가 없으면 생성
        if (!uploadPath.exists()) {
            uploadPath.mkdirs();
        }

        String originalFilename = multipartFile.getOriginalFilename();
        String storedFileName = createStoredFileName(originalFilename);

        // 파일 저장
        multipartFile.transferTo(Paths.get(uploadPath.getAbsolutePath(), storedFileName));

        // DB에 저장될 상대 경로 반환 (예: items/xxxx-xxxx-xxxx.jpg)
        // 나중에 /images/items/xxxx-xxxx-xxxx.jpg 로 접근 가능
        return dirName + "/" + storedFileName;
    }

    private String createStoredFileName(String originalFilename) {
        String ext = extractExtension(originalFilename);
        String uuid = UUID.randomUUID().toString();
        return uuid + "." + ext;
    }

    private String extractExtension(String originalFilename) {
        int pos = originalFilename.lastIndexOf(".");
        if (pos == -1 || pos == originalFilename.length() - 1) {
            return ""; // 확장자가 없는 경우
        }
        return originalFilename.substring(pos + 1);
    }
}