package com.mallang.mallnagorder.global.exception;

import com.mallang.mallnagorder.admin.exception.AdminException;
import com.mallang.mallnagorder.category.exception.CategoryException;
import com.mallang.mallnagorder.kiosk.exception.KioskException;
import com.mallang.mallnagorder.menu.exception.MenuException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.io.UnsupportedEncodingException;

@Slf4j // @SLf4j는 로깅 기능을 제공한다. log.error(..)등의 로그 출력을 사용할 수 있게 한다.
@RestControllerAdvice // @ControllerAdvice + @ResponseBody. 예외 발생 시 JSON 형태로 응답을 반환한다.
public class ExceptionControllerAdvice {

    // MethodArgumentNotValidException 처리 (검증 예외 처리)
    @ExceptionHandler(MethodArgumentNotValidException.class) // -> 클라이언트가 잘못된 형식의 데이터 전송?
    public ResponseEntity<ExceptionResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException ex) {
        log.error("Validation error: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from(ex);  // 검증 오류 메시지를 처리
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);  // 400 Bad Request
    }

    // 인코딩 관련 예외 처리
    @ExceptionHandler(UnsupportedEncodingException.class)
    public ResponseEntity<ExceptionResponse> handleUnsupportedEncodingException(UnsupportedEncodingException ex) {
        log.error("UnsupportedEncodingException 발생: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from("이메일 인증 발송에 실패했습니다. 다시 시도해주세요.");
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);  // 500 Internal Server Error
    }

    // 이미지 크기 예외 처리
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ExceptionResponse> handleMaxSizeException(MaxUploadSizeExceededException ex) {
        log.error("MaxUploadSizeExceededException 발생: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from("파일 크기가 너무 큽니다. 최대 5MB까지 업로드할 수 있습니다.");
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    // 모든 예외 처리 (Generic)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ExceptionResponse> handleGenericException(Exception ex) {
        log.error("예외 발생: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);  // 500 Internal Server Error
    }

    // AdminException
    @ExceptionHandler(AdminException.class)
    public ResponseEntity<ExceptionResponse> handleCategoryException(AdminException ex) {
        log.error("AdminException 발생: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from(ex.getExceptionType());
        return new ResponseEntity<>(response, ex.getExceptionType().getHttpStatus());
    }

    // CategoryException
    @ExceptionHandler(CategoryException.class)
    public ResponseEntity<ExceptionResponse> handleCategoryException(CategoryException ex) {
        log.error("CategoryException 발생: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from(ex.getExceptionType());
        return new ResponseEntity<>(response, ex.getExceptionType().getHttpStatus());
    }

    // MenuException
    @ExceptionHandler(MenuException.class)
    public ResponseEntity<ExceptionResponse> handleMenuException(MenuException ex) {
        log.error("MenuException 발생: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from(ex.getExceptionType());
        return new ResponseEntity<>(response, ex.getExceptionType().getHttpStatus());
    }

    // KioskException
    @ExceptionHandler(KioskException.class)
    public ResponseEntity<ExceptionResponse> handleKioskException(KioskException ex) {
        log.error("KioskException 발생: {}", ex.getMessage(), ex);
        ExceptionResponse response = ExceptionResponse.from(ex.getExceptionType());
        return new ResponseEntity<>(response, ex.getExceptionType().getHttpStatus());
    }
}