package com.db.dbworld.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class HttpClientConfig {

    private final AppProperties appProperties;

    public HttpClientConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Bean
    RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder.build();
    }

    @Bean("tmdbRestTemplate")
    RestTemplate tmdbRestTemplate(RestTemplateBuilder builder) {

        ClientHttpRequestInterceptor auth = (req, body, ex) -> {
            req.getHeaders().setBearerAuth(appProperties.getTmdbAccessToken());
            return ex.execute(req, body);
        };

        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(15))
                .additionalInterceptors(auth)
                .build();
    }

    @Bean("aria2RestTemplate")
    RestTemplate aria2RestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(20))
                .build();
    }
}
