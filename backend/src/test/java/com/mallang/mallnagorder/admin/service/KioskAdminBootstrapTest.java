package com.mallang.mallnagorder.admin.service;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.admin.repository.AdminRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class KioskAdminBootstrapTest {
    private final AdminRepository admins = mock(AdminRepository.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    @Test
    void createdAccountAuthenticatesThroughTheExistingLoginProvider() {
        new KioskAdminBootstrap(admins, passwords, "daejo_admin", "2580")
                .run(new DefaultApplicationArguments());
        ArgumentCaptor<Admin> saved = ArgumentCaptor.forClass(Admin.class);
        verify(admins).save(saved.capture());
        Admin admin = saved.getValue();
        assertEquals("daejo_admin", admin.getEmail());
        assertNotEquals("2580", admin.getPassword());
        assertEquals("대조시장", admin.getStoreName());
        assertEquals("대조시장 관리자", admin.getAdminName());
        when(admins.findByEmail("daejo_admin")).thenReturn(Optional.of(admin));

        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(new AdminDetailsService(admins));
        provider.setPasswordEncoder(passwords);
        ProviderManager manager = new ProviderManager(provider);
        assertTrue(manager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("daejo_admin", "2580"))
                .isAuthenticated());
        assertThrows(BadCredentialsException.class, () -> manager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("daejo_admin", "wrong-password")));
    }

    @Test
    void restartDoesNotResetAnExistingPassword() {
        when(admins.existsByEmail("daejo_admin")).thenReturn(true);
        new KioskAdminBootstrap(admins, passwords, "daejo_admin", "2580")
                .run(new DefaultApplicationArguments());
        verify(admins, never()).save(any());
    }

    @Test
    void configuredCredentialsAreUsedForANewAccount() {
        new KioskAdminBootstrap(admins, passwords, "configured-admin", "configured-password")
                .run(new DefaultApplicationArguments());
        ArgumentCaptor<Admin> saved = ArgumentCaptor.forClass(Admin.class);
        verify(admins).save(saved.capture());
        assertEquals("configured-admin", saved.getValue().getEmail());
        assertTrue(passwords.matches("configured-password", saved.getValue().getPassword()));
    }
}
