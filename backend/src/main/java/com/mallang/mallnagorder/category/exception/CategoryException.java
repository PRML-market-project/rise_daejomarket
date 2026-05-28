package com.mallang.mallnagorder.category.exception;

import com.mallang.mallnagorder.global.exception.BaseException;
import com.mallang.mallnagorder.global.exception.BaseExceptionType;

public class CategoryException extends BaseException {

    private final BaseExceptionType exceptionType;

    public CategoryException(BaseExceptionType exceptionType) {
        super(exceptionType.getErrorMessage());
        this.exceptionType = exceptionType;
    }

    @Override
    public BaseExceptionType getExceptionType() {
        return this.exceptionType;
    }
}
