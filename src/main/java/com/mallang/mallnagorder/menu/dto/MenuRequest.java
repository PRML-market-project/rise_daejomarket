package com.mallang.mallnagorder.menu.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class MenuRequest {
    private String menuName;
    private String menuNameEn;
    private BigDecimal menuPrice;
    private String menuCount;
    private List<Long> categoryIds;
    private MultipartFile image; // 이미지 파일 추가
}
