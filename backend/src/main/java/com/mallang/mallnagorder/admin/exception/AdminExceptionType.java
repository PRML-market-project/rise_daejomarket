package com.mallang.mallnagorder.admin.exception;

import com.mallang.mallnagorder.global.exception.BaseExceptionType;
import org.springframework.http.HttpStatus;

public enum AdminExceptionType implements BaseExceptionType {

    /*
     * 회원가입 관련
     * */
    ALREADY_EXIST_EMAIL(HttpStatus.BAD_REQUEST, "JOIN_001", "이미 가입된 이메일입니다."),
    ALREADY_EXIST_STORENAME(HttpStatus.BAD_REQUEST, "JOIN_002", "이미 존재하는 한글 가게 이름입니다."),
    ALREADY_EXIST_STORENAME_EN(HttpStatus.BAD_REQUEST, "JOIN_002", "이미 존재하는 영문 가게 이름입니다."),
    INVALID_EMAIL_FORMAT(HttpStatus.BAD_REQUEST, "JOIN_003", "잘못된 형식의 이메일입니다."),
    INVALID_PASSWORD_FORMAT(HttpStatus.BAD_REQUEST, "JOIN_004", "잘못된 형식의 비밀번호입니다."),
    WRONG_EMAIL_AUTHCODE(HttpStatus.BAD_REQUEST, "JOIN_005", "이메일 인증 번호가 일치하지 않습니다."),

    /*
     * 멤버 관련
     * */
    ADMIN_NOT_EXIST(HttpStatus.NOT_FOUND, "ADMIN_001", "관리자가 존재하지 않습니다."),
    ADMIN_INVALID_ID_AND_PASSWORD(HttpStatus.UNAUTHORIZED, "ADMIN_002", "아이디나 비밀번호가 다릅니다."),
    ADMIN_WRONG_PASSWORD(HttpStatus.UNAUTHORIZED, "ADMIN_003", "비밀번호가 일치하지 않습니다."),
    ADMIN_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "ADMIN_004", "사용자가 인증되지 않았습니다."),

    STORENAME_NOT_FOUND(HttpStatus.NOT_FOUND, "STORE_001", "해당 가게 이름이 존재하지 않습니다.");


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