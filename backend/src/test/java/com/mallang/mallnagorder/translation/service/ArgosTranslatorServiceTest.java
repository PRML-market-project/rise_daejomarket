package com.mallang.mallnagorder.translation.service;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ArgosTranslatorServiceTest {
    @Test
    void bilingualRequestsUseLocalServerWithoutCloudKey() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new ArgosTranslatorService(builder, "http://localhost:17834", true);
        server.expect(requestTo("http://localhost:17834/translate"))
            .andExpect(headerDoesNotExist("Ocp-Apim-Subscription-Key"))
            .andExpect(content().json("""
                {"texts":["김치"],"source":"ko","targets":["en","vi"]}
                """))
            .andRespond(withSuccess("""
                {"results":[{"sourceText":"김치","translations":{"en":"Kimchi","vi":"Kim chi"}}]}
                """, MediaType.APPLICATION_JSON));
        assertThat(service.translateKioskTexts(List.of("김치", "김치")).get("김치")).containsEntry("en", "Kimchi").containsEntry("vi", "Kim chi");
        server.verify();
    }
    @Test
    void legacyEnglishToVietnameseUsesSameServer() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new ArgosTranslatorService(builder, "http://localhost:17834", true);
        server.expect(requestTo("http://localhost:17834/translate"))
            .andExpect(content().json("""
                {"texts":["Rice"],"source":"en","targets":["vi"]}
                """))
            .andRespond(withSuccess("""
                {"results":[{"sourceText":"Rice","translations":{"vi":"Cơm"}}]}
                """, MediaType.APPLICATION_JSON));
        assertThat(service.translateToVietnamese("밥", "Rice")).contains("Cơm");
        server.verify();
    }
    @Test
    void failuresStayPendingAndDisabledMakesNoRequest() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new ArgosTranslatorService(builder, "http://localhost:17834", true);
        server.expect(requestTo("http://localhost:17834/translate")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertThat(service.translateKioskTexts(List.of("김치"))).isEmpty();
        assertThat(new ArgosTranslatorService(builder, "http://localhost:17834", false).translateToVietnamese("김치")).isEmpty();
        server.verify();
    }
    @Test
    void mismatchedSourceNeverUpdatesAnotherShop() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var service = new ArgosTranslatorService(builder, "http://localhost:17834", true);
        server.expect(requestTo("http://localhost:17834/translate")).andRespond(withSuccess("""
            {"results":[{"sourceText":"다른 가게","translations":{"en":"Wrong","vi":"Sai"}}]}
            """, MediaType.APPLICATION_JSON));
        assertThat(service.translateKioskTexts(List.of("김치"))).isEmpty();
        server.verify();
    }
}
