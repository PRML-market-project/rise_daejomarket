package com.mallang.mallnagorder.global.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.admin.dto.LoginRequest;
import com.mallang.mallnagorder.admin.dto.LoginResponse;
import com.mallang.mallnagorder.admin.repository.RefreshRepository;
import com.mallang.mallnagorder.global.entity.RefreshEntity;
import com.mallang.mallnagorder.global.util.JWTUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.Date;
import java.util.Iterator;

public class LoginFilter extends UsernamePasswordAuthenticationFilter {

    private final AuthenticationManager authenticationManager;
    private final JWTUtil jwtUtil;
    private final RefreshRepository refreshRepository;

    public LoginFilter(AuthenticationManager authenticationManager, JWTUtil jwtUtil, RefreshRepository refreshRepository) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.refreshRepository = refreshRepository;
    }

    @Override
    public Authentication attemptAuthentication(HttpServletRequest request, HttpServletResponse response) throws AuthenticationException {
        logger.info("Attempting to authenticate");

        LoginRequest loginRequest = new LoginRequest();
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ServletInputStream inputStream = request.getInputStream();
            String messageBody = StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);
            loginRequest = objectMapper.readValue(messageBody, LoginRequest.class);
        } catch (IOException e) {
            logger.error("Failed to read login request", e);
            throw new RuntimeException(e);
        }

        // 클라이언트 요청에서 loginId, password 추출
        String username = loginRequest.getEmail();
        String password = loginRequest.getPassword();

        // 스프링 시큐리티에서 username, password 검증을 위해 token 에 담기
        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(username, password, null);

        // token 에 담은 검증을 위한 AuthenticationManager 전달
        return authenticationManager.authenticate(authToken);
    }

    // 로그인 성공 시 실행하는 메서드
    @Override
    protected void successfulAuthentication(HttpServletRequest request, HttpServletResponse response, FilterChain chain, Authentication authentication) throws IOException {
        // 유저 정보
        String username = authentication.getName();
        Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();

        // 권한이 없으면 기본 권한 부여
        String role = "ROLE_USER";  // 기본적으로 사용자 권한

        if (!authorities.isEmpty()) {
            Iterator<? extends GrantedAuthority> iterator = authorities.iterator();
            GrantedAuthority auth = iterator.next();

            // 어드민 권한 확인
            for (GrantedAuthority authority : authorities) {
                if (authority.getAuthority().equals("ROLE_ADMIN")) {
                    role = "ROLE_ADMIN";  // 어드민 권한이 있는 경우, 어드민 권한 설정
                    break;
                }
            }
        }

        // 토큰 생성
        String access = jwtUtil.createJwt("access", username, role, 86400000L); // 생명주기 10분(600000L)
        String refresh = jwtUtil.createJwt("refresh", username, role, 86400000L); // 생명주기 24시간

        // Refresh 토큰 저장 - DB에 refresh 토큰이 쌓이는 문제 발생, 주기적으로 스케줄링 필요
        addRefreshEntity(username, refresh, 86400000L);

        // LoginResponse 객체 생성
        LoginResponse loginResponse = new LoginResponse(access, refresh);

        // 응답 설정: 응답 타입을 JSON 으로 설정
        response.setContentType("application/json");
        ObjectMapper objectMapper = new ObjectMapper();
        response.getWriter().write(objectMapper.writeValueAsString(loginResponse)); // LoginResponse 객체를 JSON 으로 직렬화하여 응답 본문에 작성

        // 응답 상태 코드 설정
        response.setStatus(HttpStatus.OK.value());
    }


    // 로그인 실패 시 실행하는 메서드 -> 실패 시 401 응답 코드 반환
    @Override
    protected void unsuccessfulAuthentication(HttpServletRequest request, HttpServletResponse response, AuthenticationException failed) {
        // 로그인 실패 시 401 응답 코드 반환
        response.setStatus(401);
    }

    private void addRefreshEntity(String username, String refresh, Long expiredMs) {
        Date date = new Date(System.currentTimeMillis() + expiredMs);

        RefreshEntity refreshEntity = new RefreshEntity();
        refreshEntity.setUsername(username);
        refreshEntity.setRefresh(refresh);
        refreshEntity.setExpiration(date.toString());

        refreshRepository.save(refreshEntity);
    }
}