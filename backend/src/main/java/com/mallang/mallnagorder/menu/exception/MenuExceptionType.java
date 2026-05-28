package com.mallang.mallnagorder.menu.exception;

import com.mallang.mallnagorder.global.exception.BaseExceptionType;
import org.springframework.http.HttpStatus;

public enum MenuExceptionType implements BaseExceptionType {

    MENU_NOT_FOUND(HttpStatus.BAD_REQUEST, "MENU_001", "해당 메뉴를 찾을 수 없습니다."),
    ALREADY_EXIST_NAME(HttpStatus.BAD_REQUEST, "MENU_002", "이미 존재하는 한글 메뉴 이름입니다."),
    ALREADY_EXIST_NAME_EN(HttpStatus.BAD_REQUEST, "MENU_003", "이미 존재하는 영어 메뉴 이름입니다."),
    MENU_HAS_ORDER(HttpStatus.BAD_REQUEST, "MENU_004", "주문 내역이 존재하는 메뉴는 삭제할 수 없습니다."),
    IMAGE_TOO_LARGE(HttpStatus.BAD_REQUEST, "MENU_005", "이미지 파일은 최대 5MB까지 업로드 가능합니다.");



    private HttpStatus httpStatus;
    private String errorCode;
    private String errorMessage;


    MenuExceptionType(HttpStatus httpStatus, String errorCode, String errorMessage) {
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
