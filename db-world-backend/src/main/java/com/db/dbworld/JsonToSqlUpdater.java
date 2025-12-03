package com.db.dbworld;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;

import java.io.File;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

public class JsonToSqlUpdater {

    @Value("${spring.datasource.url}")
    static String dbUrl;
    @Value("${spring.datasource.username}")
    static String user;
    @Value("${spring.datasource.password}")
    static String password;

    private static void executeBatchUpdate(List<Map<String, String>> dataList) {

        String tableName = "SPOKEN_LANGUAGES";
        String pkColumn = "iso_639_1";

        // Dynamically build the SQL statement
        String updateColumns = "english_name = ?, name = ?";
        String sql = "UPDATE " + tableName + " SET " + updateColumns + " WHERE " + pkColumn + " = ?";

        try (Connection conn = DriverManager.getConnection(dbUrl, user, password);
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            for (Map<String, String> item : dataList) {
                // Set parameters for each row
                pstmt.setString(1, item.get("english_name")); // 1st '?'
                pstmt.setString(2, item.get("name"));         // 2nd '?'
                pstmt.setString(3, item.get(pkColumn));       // 3rd '?' (for WHERE clause)

                // Add the current set of parameters to the batch
                pstmt.addBatch();
            }

            // Execute the batch update
            int[] updateCounts = pstmt.executeBatch();
            System.out.println("Batch update executed successfully.");
            System.out.println("Updated rows: " + updateCounts.length);

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) throws IOException {

        ObjectMapper mapper = new ObjectMapper();
        List<Map<String, String>> dataList = mapper.readValue(new File("db-world-backend/src/main/resources/languages.json"), new TypeReference<>() {});

        // Build and execute the queries
        executeBatchUpdate(dataList);
    }
}

