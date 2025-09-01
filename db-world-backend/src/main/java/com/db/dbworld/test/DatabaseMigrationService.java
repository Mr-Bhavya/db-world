package com.db.dbworld.test;

import jakarta.persistence.EntityManager;;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class DatabaseMigrationService {

    private final JdbcTemplate jdbcTemplate;
    private final EntityManager entityManager;

    public DatabaseMigrationService(JdbcTemplate jdbcTemplate, EntityManager entityManager) {
        this.jdbcTemplate = jdbcTemplate;
        this.entityManager = entityManager;
    }

    @Transactional
    public void migrateColumnsWithData() {
        // Get all tables from the database
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()",
                String.class);

        for (String table : tables) {
            // Get all columns for the current table
            List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS " +
                            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                    table);

            // Process each column
            for (Map<String, Object> column : columns) {
                String columnName = (String) column.get("COLUMN_NAME");
                String dataType = (String) column.get("DATA_TYPE");
                String columnType = (String) column.get("COLUMN_TYPE");

                // Check if column is camelCase and needs migration
                if (columnName.matches(".*[a-z][A-Z].*")) {
                    String newColumnName = convertToSnakeCase(columnName);

                    // Check if snake_case version already exists
                    boolean snakeCaseExists = columns.stream()
                            .anyMatch(c -> newColumnName.equalsIgnoreCase((String) c.get("COLUMN_NAME")));

                    if (!snakeCaseExists) {
                        // Rename the column and preserve data
                        String sql = String.format(
                                "ALTER TABLE %s CHANGE %s %s %s",
                                table, columnName, newColumnName, columnType);

                        jdbcTemplate.execute(sql);
                        System.out.println("Migrated: " + table + "." + columnName + " → " + newColumnName);
                    } else {
                        System.out.println("Skipped: " + table + "." + columnName +
                                " (snake_case version already exists)");
                    }
                }
            }
        }
    }

    private String convertToSnakeCase(String camelCase) {
        return camelCase.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
    }
}
