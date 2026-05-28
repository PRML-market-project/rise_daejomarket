package com.mallang.mallnagorder.global.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ExceptionResponse {
    private String message;  // 예외 메시지
    private String errorCode;  // 예외 코드

    // BaseExceptionType을 통해 메시지와 에러 코드 생성
    public static ExceptionResponse from(BaseExceptionType exceptionType) {
        return new ExceptionResponse(exceptionType.getErrorMessage(), exceptionType.getErrorCode());
    }

    // String 메시지를 처리하는 메서드 추가
    public static ExceptionResponse from(String message) {
        return new ExceptionResponse(message, "UNKNOWN_ERROR");  // 에러 코드 기본값 설정
    }

    // MethodArgumentNotValidException 처리 (검증 예외 처리)
    public static ExceptionResponse from(MethodArgumentNotValidException e) {
        StringBuilder message = new StringBuilder();
        StringBuilder errorCode = new StringBuilder();

        for (FieldError fieldError : e.getBindingResult().getFieldErrors()) {
            message.append(fieldError.getDefaultMessage()).append(" ");
            errorCode.append(fieldError.getField()).append(": ").append(fieldError.getDefaultMessage()).append(" ");
        }

        return new ExceptionResponse(message.toString(), errorCode.toString());
    }
}