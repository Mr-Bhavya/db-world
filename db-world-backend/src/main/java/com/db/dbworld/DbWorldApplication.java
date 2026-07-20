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
@OpenAPIDefinition(info = @Info(title = "db-world API", version = "v1"))
public class DbWorldApplication {

    public static void main(String[] args) {
        // Switch Log4j2 to a fully-async context — every Logger.info() etc.
        // goes through the LMAX Disruptor without an <Async> wrapper. Must be
        // set before Log4j2 initializes (i.e., before the first SLF4J call).
        // Pairs with com.lmax:disruptor on the classpath (pinned in pom).
        System.setProperty("log4j2.contextSelector",
                "org.apache.logging.log4j.core.async.AsyncLoggerContextSelector");
        // Avoid stalling caller threads when the async ring buffer is full:
        // discard the lowest-priority records (TRACE/DEBUG) rather than block.
        System.setProperty("log4j2.asyncQueueFullPolicy", "Discard");
        System.setProperty("log4j2.discardThreshold", "DEBUG");

        SpringApplication.run(DbWorldApplication.class, args);
    }
}
