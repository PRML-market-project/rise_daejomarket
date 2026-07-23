package com.mallang.mallnagorder.translation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class VietnameseMenuCountTranslator {

    private static final Pattern KOREAN_PATTERN = Pattern.compile("[가-힣]");

    private final AzureTranslatorService azureTranslatorService;

    public Optional<String> translate(String menuCount, String menuNameEn) {
        if (!StringUtils.hasText(menuCount)) {
            return Optional.empty();
        }

        boolean fruit = isFruit(menuNameEn);
        String translated = menuCount.trim()
                .replaceAll("(\\d+)\\s*바구니", "$1 giỏ")
                .replaceAll("(\\d+)\\s*박스", "$1 hộp")
                .replaceAll("(\\d+)\\s*통", fruit ? "$1 quả" : "$1 thùng")
                .replaceAll("(\\d+)\\s*그릇", "$1 bát")
                .replaceAll("(\\d+)\\s*공기", "$1 bát")
                .replaceAll("(\\d+)\\s*송이", isBanana(menuNameEn) ? "$1 nải" : "$1 chùm")
                .replaceAll("(\\d+)\\s*개", fruit ? "$1 quả" : "$1 cái")
                .replaceAll("(\\d+)\\s*kg", "$1 kg");

        if (!KOREAN_PATTERN.matcher(translated).find()) {
            return Optional.of(translated);
        }
        return azureTranslatorService.translateToVietnamese(menuCount);
    }

    private boolean isFruit(String menuNameEn) {
        if (!StringUtils.hasText(menuNameEn)) {
            return false;
        }
        String name = menuNameEn.toLowerCase(Locale.ROOT);
        return name.contains("watermelon")
                || name.contains("melon")
                || name.contains("tangerine")
                || name.contains("muscat")
                || name.contains("apple")
                || name.contains("kiwi")
                || name.contains("banana")
                || name.contains("strawberry")
                || name.contains("peach")
                || name.contains("mango")
                || name.contains("pear")
                || name.contains("persimmon");
    }

    private boolean isBanana(String menuNameEn) {
        return StringUtils.hasText(menuNameEn)
                && menuNameEn.toLowerCase(Locale.ROOT).contains("banana");
    }
}
