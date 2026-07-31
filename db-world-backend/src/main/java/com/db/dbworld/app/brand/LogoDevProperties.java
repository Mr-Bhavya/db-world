package com.db.dbworld.app.brand;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * logo.dev connection details. The <b>secret</b> key (sk_…) powers the Brand
 * Search API and must never reach the client bundle — hence this server-side
 * proxy. The publishable key (pk_…) used for logo images lives in the frontend.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "logodev")
public class LogoDevProperties {
    private String secretKey;
    private String baseUrl = "https://api.logo.dev";
}
