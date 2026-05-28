package com.mallang.mallnagorder.kiosk.exception;

import com.mallang.mallnagorder.global.exception.BaseExceptionType;
import org.springframework.http.HttpStatus;

public enum KioskExceptionType implements BaseExceptionType{

    KIOSK_NOT_FOUND(HttpStatus.BAD_REQUEST, "KIOSK_001", "해당 테이블을 찾을 수 없습니다."),
    ACTIVE_KIOSK_EXISTS(HttpStatus.BAD_REQUEST, "KIOSK_002", "사용 중인 테이블이 존재해 테이블 수를 변경할 수 없습니다."),
    ALEADY_ACTIVE_KIOSK(HttpStatus.CONFLICT, "KIOSK_003", "이미 사용 중인 테이블 번호 입니다."),
    ORDER_NOT_FOUND(HttpStatus.CONFLICT, "KIOSK_004", "아직 테이블 주문 내역이 없습니다.");

    private HttpStatus httpStatus;
    private String errorCode;
    private String errorMessage;

    KioskExceptionType(HttpStatus httpStatus, String errorCode, String errorMessage) {
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

