package com.mallang.mallnagorder.category.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CategoryRequest {
    private String categoryName;
    private String categoryNameEn;
    private String categoryType;
}
