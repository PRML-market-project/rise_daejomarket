package com.mallang.mallnagorder.translation.dto;

public record VietnameseBackfillResponse(
        boolean translatorConfigured,
        int storesUpdated,
        int categoriesUpdated,
        int menusUpdated
) {
}
