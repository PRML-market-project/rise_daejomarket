package com.mallang.mallnagorder.kiosk.exception;

import com.mallang.mallnagorder.global.exception.BaseException;
import com.mallang.mallnagorder.global.exception.BaseExceptionType;

public class KioskException extends BaseException {

    private final BaseExceptionType exceptionType;

    public KioskException(BaseExceptionType exceptionType) {
        super(exceptionType.getErrorMessage());
        this.exceptionType = exceptionType;
    }

    @Override
    public BaseExceptionType getExceptionType() {
        return this.exceptionType;
    }
}

