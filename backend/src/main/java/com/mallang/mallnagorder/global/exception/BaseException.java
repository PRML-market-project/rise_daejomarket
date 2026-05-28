package com.mallang.mallnagorder.global.exception;

public abstract class BaseException extends RuntimeException{
    public BaseException(String message) {
        super(message);  // RuntimeException의 생성자 호출
    }

    //BaseExceptionType을 반환하는 메서드
    public abstract BaseExceptionType getExceptionType();

}