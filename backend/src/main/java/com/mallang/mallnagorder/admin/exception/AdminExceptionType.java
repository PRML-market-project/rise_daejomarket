package com.mallang.mallnagorder.admin.exception;

import com.mallang.mallnagorder.global.exception.BaseExceptionType;
import org.springframework.http.HttpStatus;

public enum AdminExceptionType implements BaseExceptionType {

    ADMIN_NOT_EXIST(HttpStatus.NOT_FOUND, "ADMIN_001", "관리자가 존재하지 않습니다.");


    private HttpStatus httpStatus;
    private String errorCode;
    private String errorMessage;

    AdminExceptionType(HttpStatus httpStatus, String errorCode, String errorMessage) {
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