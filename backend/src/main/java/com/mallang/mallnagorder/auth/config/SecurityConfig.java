package com.mallang.mallnagorder.auth.config;



import com.mallang.mallnagorder.admin.repository.AdminRepository;
import com.mallang.mallnagorder.admin.repository.RefreshRepository;
import com.mallang.mallnagorder.global.filter.JWTFilter;
import com.mallang.mallnagorder.global.filter.LoginFilter;
import com.mallang.mallnagorder.global.filter.LogoutFilter;
import com.mallang.mallnagorder.global.util.JWTUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.security.servlet.PathRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Collections;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AuthenticationConfiguration authenticationConfiguration;
    private final JWTUtil jwtUtil;
    private final RefreshRepository refreshRepository;
    private final AdminRepository adminRepository; // ✅ 추가

    // ✅ 생성자에서 주입
    public SecurityConfig(AuthenticationConfiguration authenticationConfiguration,
                          JWTUtil jwtUtil,
                          RefreshRepository refreshRepository,
                          AdminRepository adminRepository) {
        this.authenticationConfiguration = authenticationConfiguration;
        this.jwtUtil = jwtUtil;
        this.refreshRepository = refreshRepository;
        this.adminRepository = adminRepository;
    }


    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        return (web) -> web.ignoring()
                .requestMatchers(PathRequest.toStaticResources().atCommonLocations());
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public BCryptPasswordEncoder bCryptPasswordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // CORS 설정
        http
                .cors(corsCustomizer -> corsCustomizer.configurationSource(new CorsConfigurationSource() {
                    @Override
                    public CorsConfiguration getCorsConfiguration(HttpServletRequest request) {
                        CorsConfiguration configuration = new CorsConfiguration();
//                        configuration.setAllowedOrigins(List.of(
//                                "http://localhost:3000",
//                                "https://localhost:3000",
//                                "http://localhost:5173",
//                                "https://localhost:5173",
//                                "https://mallang-order-admin.vercel.app", // 실제 배포된 프론트 주소
//                                "https://mallang-test.vercel.app"
//                        ));
                        configuration.setAllowedOriginPatterns(List.of("*"));
                        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                        configuration.setAllowedHeaders(List.of("*"));
                        configuration.setAllowCredentials(true);
                        configuration.setMaxAge(3600L);
                        configuration.setExposedHeaders(List.of("Set-Cookie", "access"));
                        return configuration;
                    }
                }));

        // csrf 비활성화
        http.csrf().disable();

        // formLogin 비활성화
        http.formLogin().disable();

        // httpBasic 비활성화
        http.httpBasic().disable();

        http.headers().frameOptions().disable(); //


        // 경로별 인가 설정
        http.authorizeHttpRequests((auth) -> auth
                .requestMatchers("/api/login").permitAll()
                .requestMatchers("/api/logout").permitAll()
                .requestMatchers("/api/**", "/api/join", "/**", "/api/member/**").permitAll()
                .requestMatchers("/api/admin").hasRole("ADMIN")
                .requestMatchers("/api/reissue").permitAll()
                .requestMatchers("/h2-console/**").permitAll() // H2 Console 허용
                .anyRequest().authenticated()
        );

        // 필터 추가 및 순서 설정
        http
                .addFilterBefore(new LoginFilter(authenticationManager(authenticationConfiguration), jwtUtil, refreshRepository), UsernamePasswordAuthenticationFilter.class)  // 로그인 필터
                .addFilterBefore(new JWTFilter(jwtUtil, adminRepository), LoginFilter.class)  // JWT 필터
                .addFilterAfter(new LogoutFilter(jwtUtil, refreshRepository), JWTFilter.class);  // 로그아웃 필터 위치 (JWT 필터 뒤에)

        // 세션 설정 (Stateless)
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        return http.build();
    }
}
