package com.mallang.mallnagorder.menu.exception;

import com.mallang.mallnagorder.global.exception.BaseException;
import com.mallang.mallnagorder.global.exception.BaseExceptionType;

public class MenuException extends BaseException {

    private final BaseExceptionType exceptionType;

    public MenuException(BaseExceptionType exceptionType) {
        super(exceptionType.getErrorMessage());
        this.exceptionType = exceptionType;
    }

    @Override
    public BaseExceptionType getExceptionType() {
        return this.exceptionType;
    }
}
