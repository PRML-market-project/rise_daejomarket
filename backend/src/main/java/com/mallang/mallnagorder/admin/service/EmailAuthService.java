package com.mallang.mallnagorder.admin.service;

import com.mallang.mallnagorder.admin.service.MailService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.RedisTemplate;
import jakarta.mail.MessagingException;
import java.io.UnsupportedEncodingException;
import java.util.concurrent.TimeUnit;

@Service
public class EmailAuthService {

    private final RedisTemplate<String, String> redisTemplate;
    private final MailService mailService;

    // 인증번호 유효 기간 (3분으로 설정)
    private static final long AUTH_EXPIRATION_TIME = 3L; // minutes

    public EmailAuthService(@Qualifier("redisTemplate") RedisTemplate<String, String> redisTemplate, MailService mailService) {
        this.redisTemplate = redisTemplate;
        this.mailService = mailService;
    }

    // 인증번호 발송 메서드
    public String sendAuthNumber(String email) throws MessagingException, UnsupportedEncodingException {
        // 인증번호 생성
        String authNumber = generateAuthNumber();

        // Redis에 이메일을 키로, 인증 번호를 값으로 저장 (3분 후 만료)
        redisTemplate.opsForValue().set(email, authNumber, AUTH_EXPIRATION_TIME, TimeUnit.MINUTES);

        // 이메일 발송 로직
        mailService.sendMail(email, authNumber);

        return authNumber;
    }

    // 인증번호 검증 메서드
    public boolean validateAuthNumber(String email, String authNumber) {
        // Redis에서 인증 번호를 가져옴
        String storedAuthNumber = redisTemplate.opsForValue().get(email);

        // 인증 번호가 없거나, 입력한 인증 번호와 일치하지 않으면 false
        if (storedAuthNumber == null || !storedAuthNumber.equals(authNumber)) {
            return false;
        }

        // 인증 성공 후 Redis에서 인증 번호 삭제
        redisTemplate.delete(email);

        return true;
    }

    // 인증번호 생성 메서드 (랜덤한 6자리 숫자)
    private String generateAuthNumber() {
        int authNum = (int) (Math.random() * 1000000);
        return String.format("%06d", authNum);
    }
}
