package com.mallang.mallnagorder.auth.exception;

import com.mallang.mallnagorder.global.exception.BaseExceptionType;
import org.springframework.http.HttpStatus;

public enum AuthExceptionType implements BaseExceptionType {

    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "AUTH_001", "잘못된 인증 정보입니다."),
    ACCOUNT_LOCKED(HttpStatus.FORBIDDEN, "AUTH_002", "계정이 잠겨 있습니다."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "AUTH_003", "토큰이 만료되었습니다."),
    UNAUTHORIZED_ACCESS(HttpStatus.FORBIDDEN, "AUTH_004", "권한이 없는 접근입니다."),
    INVALID_AUTHORIZATION_HEADER(HttpStatus.UNAUTHORIZED, "AUTH_005", "Authorization header가 잘못되었습니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_006", "토큰 정보가 유효하지 않습니다.");  // 새로운 예외 추가


    private final HttpStatus httpStatus;
    private final String errorCode;
    private final String errorMessage;

    AuthExceptionType(HttpStatus httpStatus, String errorCode, String errorMessage) {
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
