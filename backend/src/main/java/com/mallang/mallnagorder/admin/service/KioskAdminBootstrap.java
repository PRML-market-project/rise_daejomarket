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
            @Value("${KIOSK_ADMIN_USERNAME:daejo}") String username,
            @Value("${KIOSK_ADMIN_PASSWORD:2580}") String password) {
        this.admins = admins;
        this.passwords = passwords;
        this.username = username;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Admin admin = admins.findByEmail(username).orElse(null);
        // Rename the old default account in place so shops and analytics retain
        // their existing admin ID. Custom bootstrap accounts are independent.
        if (admin == null && "daejo".equals(username)) {
            admin = admins.findByEmail("daejo_admin").orElse(null);
        }
        boolean changed = false;
        if (admin == null) {
            admin = new Admin();
            admin.setAdminName("대조시장 관리자");
            admin.setStoreName("대조시장");
            changed = true;
        }
        if (!username.equals(admin.getEmail())) {
            admin.setEmail(username);
            changed = true;
        }
        if (admin.getPassword() == null || !passwords.matches(password, admin.getPassword())) {
            admin.setPassword(passwords.encode(password));
            changed = true;
        }
        if (changed) admins.save(admin);
    }
}
