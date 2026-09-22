package com.mallang.mallnagorder.kiosk.experience.controller;

import com.mallang.mallnagorder.global.util.LocalFileUploader;
import com.mallang.mallnagorder.kiosk.experience.dto.*;
import com.mallang.mallnagorder.kiosk.experience.service.KioskExperienceService;
import com.mallang.mallnagorder.kiosk.experience.service.KioskExperienceEventBroker;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/kiosk-experience")
@RequiredArgsConstructor
public class KioskExperienceController {
    private static final long MEDIA_MAX_BYTES = 100L * 1024 * 1024;
    private static final long ICON_MAX_BYTES = 1024 * 1024;
    private static final Set<String> MEDIA_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm");
    private static final Set<String> ICON_TYPES = Set.of("image/svg+xml", "image/png");

    private final KioskExperienceService service;
    private final KioskExperienceEventBroker eventBroker;
    private final LocalFileUploader uploader;

    @GetMapping
    public KioskExperienceResponse get() { return service.get(); }

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() { return eventBroker.subscribe(service.get()); }

    @PutMapping("/mode")
    public KioskExperienceResponse updateMode(@RequestBody OperationModeRequest request) {
        KioskExperienceResponse response = service.updateMode(request.getOperationMode());
        eventBroker.publish(response);
        return response;
    }

    @PutMapping("/promotions")
    public KioskExperienceResponse updatePromotions(@RequestBody PromotionListRequest request) {
        KioskExperienceResponse response = service.updatePromotions(request.getPromotions());
        eventBroker.publish(response);
        return response;
    }

    @PutMapping("/search-tags")
    public KioskExperienceResponse updateTags(@RequestBody SearchTagListRequest request) {
        KioskExperienceResponse response = service.updateSearchTags(request.getSearchTags());
        eventBroker.publish(response);
        return response;
    }

    @PutMapping("/shops")
    public KioskExperienceResponse updateShops(@RequestBody ManagedShopListRequest request) {
        KioskExperienceResponse response = service.updateShops(request.getShops());
        eventBroker.publish(response);
        return response;
    }

    @PostMapping(value = "/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadedAssetResponse> uploadMedia(@RequestPart("file") MultipartFile file) throws IOException {
        validate(file, MEDIA_TYPES, MEDIA_MAX_BYTES, "이미지 또는 MP4/WebM 영상만 등록할 수 있습니다.");
        String path = uploader.upload(file, "promotions");
        String type = file.getContentType() != null && file.getContentType().startsWith("video/") ? "video" : "image";
        return ResponseEntity.ok(new UploadedAssetResponse(file.getOriginalFilename(), type, "/images/" + path));
    }

    @PostMapping(value = "/icons", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadedAssetResponse> uploadIcon(@RequestPart("file") MultipartFile file) throws IOException {
        validate(file, ICON_TYPES, ICON_MAX_BYTES, "SVG 또는 투명 PNG 아이콘만 등록할 수 있습니다.");
        String path = uploader.upload(file, "search-icons");
        return ResponseEntity.ok(new UploadedAssetResponse(file.getOriginalFilename(), "icon", "/images/" + path));
    }

    private void validate(MultipartFile file, Set<String> allowedTypes, long maxBytes, String message) {
        if (file.isEmpty() || !allowedTypes.contains(file.getContentType()) || file.getSize() > maxBytes) {
            throw new IllegalArgumentException(message);
        }
    }
}
