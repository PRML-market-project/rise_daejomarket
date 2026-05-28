package com.mallang.mallnagorder.auth.exception;

import com.mallang.mallnagorder.global.exception.BaseException;
import com.mallang.mallnagorder.global.exception.ExceptionResponse;

public class AuthException extends BaseException {

    private final AuthExceptionType exceptionType;

    public AuthException(AuthExceptionType exceptionType) {
        super(exceptionType.getErrorMessage());  // 예외 메시지를 부모 클래스에 전달
        this.exceptionType = exceptionType;
    }

    @Override
    public AuthExceptionType getExceptionType() {
        return this.exceptionType;
    }

    // ExceptionResponse 반환하도록 수정
    public ExceptionResponse toExceptionResponse() {
        return ExceptionResponse.from(this.exceptionType);  // exceptionType 에서 메시지와 코드 반환
    }
}
