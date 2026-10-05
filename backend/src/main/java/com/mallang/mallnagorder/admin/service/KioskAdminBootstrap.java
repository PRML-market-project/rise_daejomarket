package com.mallang.mallnagorder.admin.service;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.admin.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@ConditionalOnProperty(prefix = "kiosk.admin.bootstrap", name = "enabled", havingValue = "true", matchIfMissing = true)
public class KioskAdminBootstrap implements ApplicationRunner {
    private final AdminRepository admins;
    private final BCryptPasswordEncoder passwords;
    private final String username;
    private final String password;

    public KioskAdminBootstrap(
            AdminRepository admins,
            BCryptPasswordEncoder passwords,
            @Value("${KIOSK_ADMIN_USERNAME:daejo_admin}") String username,
            @Value("${KIOSK_ADMIN_PASSWORD:2580}") String password) {
        this.admins = admins;
        this.passwords = passwords;
        this.username = username;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // Create once. Subsequent restarts preserve the account's saved password.
        if (admins.existsByEmail(username)) return;

        Admin admin = new Admin();
        admin.setEmail(username);
        admin.setPassword(passwords.encode(password));
        admin.setAdminName("대조시장 관리자");
        admin.setStoreName("대조시장");
        admins.save(admin);
    }
}
