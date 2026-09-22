package com.mallang.mallnagorder.kiosk.experience.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Getter
@NoArgsConstructor
public class SearchTagListRequest {
    private List<SearchTagDto> searchTags = new ArrayList<>();
}
