package com.db.dbworld.test;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/migration")
public class MigrationController {

    private final DatabaseMigrationService migrationService;

    public MigrationController(DatabaseMigrationService migrationService) {
        this.migrationService = migrationService;
    }

    @GetMapping("/columns-to-snakecase")
    public String migrateColumns() {
        migrationService.migrateColumnsWithData();
        return "Column migration completed successfully";
    }
}
