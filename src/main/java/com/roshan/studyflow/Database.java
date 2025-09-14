package com.roshan.studyflow;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

public class Database {

    private static final String DB_URL = "jdbc:h2:./studyflow_db";
    private static final String DB_USER = "sa";
    private static final String DB_PASSWORD = "";

    public static void initialize() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {

            String tasksSql = "CREATE TABLE IF NOT EXISTS tasks (" +
                              "id INT AUTO_INCREMENT PRIMARY KEY," +
                              "title VARCHAR(255) NOT NULL," +
                              "content TEXT," +
                              "status VARCHAR(50) NOT NULL," +
                              "dueDate VARCHAR(50))";
            stmt.executeUpdate(tasksSql);

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }
}
