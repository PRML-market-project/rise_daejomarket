package com.mallang.mallnagorder.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {


    @Value("${file.resourceUrl}")
    private String resourceUrl;

    @Value("${file.uploadDir}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // /images/** URL로 요청이 오면, C:/project-uploads/ 경로에서 파일을 찾아 제공
        registry.addResourceHandler(resourceUrl)
                .addResourceLocations("file:///" + uploadDir);
    }
}