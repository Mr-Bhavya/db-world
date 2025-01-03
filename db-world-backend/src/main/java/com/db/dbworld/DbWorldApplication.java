package com.db.dbworld;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableAsync
@EnableCaching
@EnableScheduling
@EnableJpaAuditing
@EnableJpaRepositories
@SpringBootApplication
@OpenAPIDefinition(info = @Info(title = "DB-WORLD APIS", version = "1.0", description = ""))
public class DbWorldApplication {

    public static void main(String[] args) {
        SpringApplication.run(DbWorldApplication.class, args);
    }

}
