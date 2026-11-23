package com.mallang.mallnagorder.global.exception;

import com.mallang.mallnagorder.kiosk.control.LocalShutdownController;
import com.mallang.mallnagorder.kiosk.control.LocalShutdownService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ExceptionControllerAdviceTest {
    @RestController static class MissingEndpoint {
        @GetMapping("/missing") void missing() throws NoResourceFoundException {
            throw new NoResourceFoundException(HttpMethod.GET, "api/kiosk-control/shutdown");
        }
    }
    @Test void missingEndpointReturns404InsteadOfGeneric500() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new MissingEndpoint()).setControllerAdvice(new ExceptionControllerAdvice()).build();
        mvc.perform(get("/missing")).andExpect(status().isNotFound()).andExpect(jsonPath("$.errorCode").value("NOT_FOUND"));
    }
    @Test void getCanCheckShutdownRouteWithoutLaunchingShutdown() throws Exception {
        var service = mock(LocalShutdownService.class);
        var mvc = MockMvcBuilders.standaloneSetup(new LocalShutdownController(service)).setControllerAdvice(new ExceptionControllerAdvice()).build();
        mvc.perform(get("/api/kiosk-control/shutdown")).andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.errorCode").value("METHOD_NOT_ALLOWED"));
        verifyNoInteractions(service);
    }
}
