package com.db.dbworld.test;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Profile("local")
public class MigrationRunner {

    @Bean
    @Order(1)
    public CommandLineRunner columnNameMigrationRunner(DatabaseMigrationService service) {
        // Changed bean name from migrationRunner to columnNameMigrationRunner
        return args -> {
            try {
                System.out.println("Starting column name migration...");
                service.migrateColumnsWithData();
            } catch (Exception e) {
                System.err.println("Migration failed!");
                e.printStackTrace();
                throw e;
            }
        };
    }
}
