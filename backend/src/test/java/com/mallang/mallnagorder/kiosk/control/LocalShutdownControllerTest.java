package com.mallang.mallnagorder.kiosk.control;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.io.IOException;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LocalShutdownControllerTest {
    private final LocalShutdownService service = mock(LocalShutdownService.class);
    private final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders.standaloneSetup(new LocalShutdownController(service)).build();

    @ParameterizedTest @ValueSource(strings = {"http://localhost:5173", "http://127.0.0.1:3000", "http://[::1]:5173"})
    void localAdminCanRequestShutdown(String origin) throws Exception {
        mvc.perform(post("/api/kiosk-control/shutdown").header("Origin", origin).header("X-Kiosk-Control", "admin-header"))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("stopping"));
        verify(service).shutdown();
    }
    @ParameterizedTest @ValueSource(strings = {"https://example.com", "http://localhost.evil:5173", "http://localhost:5173/path", "http://localhost:9999", "null", "not-a-url", "http://user@localhost:5173"})
    void refusesOtherOrigins(String origin) throws Exception {
        mvc.perform(post("/api/kiosk-control/shutdown").header("Origin", origin).header("X-Kiosk-Control", "admin-header"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings = {"Forwarded", "X-Forwarded-For", "X-Forwarded-Host", "CF-Connecting-IP", "True-Client-IP"})
    void refusesTunnelsEvenWhenTheyConnectFromLoopback(String header) throws Exception {
        mvc.perform(post("/api/kiosk-control/shutdown").header("Origin", "http://localhost:5173").header("X-Kiosk-Control", "admin-header").header(header, "remote"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void refusesRemotePeersAndUnmarkedRequests() throws Exception {
        mvc.perform(post("/api/kiosk-control/shutdown").header("Origin", "http://localhost:5173").header("X-Kiosk-Control", "admin-header")
                        .with(request -> { request.setRemoteAddr("192.168.0.50"); return request; })).andExpect(status().isForbidden());
        mvc.perform(post("/api/kiosk-control/shutdown").header("Origin", "http://localhost:5173")).andExpect(status().isForbidden());
        mvc.perform(post("/api/kiosk-control/shutdown").header("X-Kiosk-Control", "admin-header")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void reportsLaunchFailureInsteadOfClaimingShutdown() throws Exception {
        doThrow(new IOException("launch failed")).when(service).shutdown();
        mvc.perform(post("/api/kiosk-control/shutdown").header("Origin", "http://localhost:5173").header("X-Kiosk-Control", "admin-header"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.message").exists());
    }
}
