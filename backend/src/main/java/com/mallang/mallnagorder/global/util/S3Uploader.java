
/*
package com.mallang.mallnagorder.global.util;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.amazonaws.services.s3.AmazonS3Client;
import com.amazonaws.services.s3.model.PutObjectRequest;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
@Service
public class S3Uploader {

    private final AmazonS3Client amazonS3Client;

    @Value("${cloud.aws.s3.bucketName}")
    private String bucket;

    public String upload(MultipartFile multipartFile, String dirName) throws IOException {
        File uploadFile = convertToTempFile(multipartFile)
                .orElseThrow(() -> new IllegalArgumentException("Failed to convert MultipartFile to File"));

        try {
            return uploadToS3(uploadFile, dirName);
        } finally {
            deleteLocalFile(uploadFile);
        }
    }

    private String uploadToS3(File uploadFile, String dirName) {
        String fileName = dirName + "/" + generateUniqueFileName(uploadFile.getName());

        // ACL 설정 제거 (버킷이 ACL 비활성화 되어있는 경우)
        PutObjectRequest putObjectRequest = new PutObjectRequest(bucket, fileName, uploadFile);

        amazonS3Client.putObject(putObjectRequest);

        return amazonS3Client.getUrl(bucket, fileName).toString();
    }

    private Optional<File> convertToTempFile(MultipartFile multipartFile) throws IOException {
        String originalFilename = multipartFile.getOriginalFilename();

        if (originalFilename == null || originalFilename.isBlank()) {
            return Optional.empty();
        }

        String prefix = UUID.randomUUID().toString();
        String suffix = extractExtension(originalFilename);

        File tempFile = File.createTempFile(prefix, suffix);
        try (FileOutputStream fos = new FileOutputStream(tempFile)) {
            fos.write(multipartFile.getBytes());
        }
        return Optional.of(tempFile);
    }

    private void deleteLocalFile(File file) {
        if (file.delete()) {
            log.info("Temporary file deleted: {}", file.getAbsolutePath());
        } else {
            log.warn("Failed to delete temporary file: {}", file.getAbsolutePath());
        }
    }

    private String generateUniqueFileName(String originalName) {
        String extension = extractExtension(originalName);
        return UUID.randomUUID().toString() + extension;
    }

    private String extractExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        return dotIndex != -1 ? fileName.substring(dotIndex) : "";
    }
}
*/