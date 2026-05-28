package com.mallang.mallnagorder.category.exception;

import com.mallang.mallnagorder.global.exception.BaseExceptionType;
import org.springframework.http.HttpStatus;

public enum CategoryExceptionType implements BaseExceptionType {

    ALREADY_EXIST_NAME(HttpStatus.BAD_REQUEST, "CATEGORY_001", "이미 존재하는 한글 카테고리 이름입니다."),
    ALREADY_EXIST_NAME_EN(HttpStatus.BAD_REQUEST, "CATEGORY_002", "이미 존재하는 영어 카테고리 이름입니다."),
    CATEGORY_NOT_FOUND(HttpStatus.BAD_REQUEST, "CATEGORY_003", "해당 카테고리를 찾을 수 없습니다."),
    CANNOT_DELETE_DEFAULT_CATEGORY(HttpStatus.BAD_REQUEST, "CATEGORY_004", "Default 카테고리는 삭제할 수 없습니다.");

    private HttpStatus httpStatus;
    private String errorCode;
    private String errorMessage;


    CategoryExceptionType(HttpStatus httpStatus, String errorCode, String errorMessage) {
        this.httpStatus = httpStatus;
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
    }

    @Override
    public HttpStatus getHttpStatus() {
        return this.httpStatus;
    }

    @Override
    public String getErrorCode() {
        return this.errorCode;
    }

    @Override
    public String getErrorMessage() {
        return this.errorMessage;
    }
}
