package com.mallang.mallnagorder.translation.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AzureTranslatorServiceTest {

    @Test
    void translatesKoreanTextToVietnamese() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        AzureTranslatorService service = new AzureTranslatorService(
                builder,
                "https://translator.test",
                "test-key",
                "koreacentral"
        );

        server.expect(requestTo(
                        "https://translator.test/translate?api-version=3.0&from=ko&to=vi"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Ocp-Apim-Subscription-Key", "test-key"))
                .andExpect(header("Ocp-Apim-Subscription-Region", "koreacentral"))
                .andRespond(withSuccess(
                        """
                        [{
                          "translations": [{
                            "text": "Bánh gạo cay",
                            "to": "vi"
                          }]
                        }]
                        """,
                        MediaType.APPLICATION_JSON
                ));

        assertThat(service.translateToVietnamese("떡볶이"))
                .contains("Bánh gạo cay");
        server.verify();
    }

    @Test
    void skipsRemoteCallWhenApiKeyIsMissing() {
        AzureTranslatorService service = new AzureTranslatorService(
                RestClient.builder(),
                "https://translator.test",
                "",
                ""
        );

        assertThat(service.isConfigured()).isFalse();
        assertThat(service.translateToVietnamese("김밥")).isEmpty();
    }
}
