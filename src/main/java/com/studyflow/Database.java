package com.studyflow;

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

            String sql = "CREATE TABLE IF NOT EXISTS notes (" +
                         "id INT AUTO_INCREMENT PRIMARY KEY," +
                         "title VARCHAR(255) NOT NULL," +
                         "content TEXT NOT NULL)";
            stmt.executeUpdate(sql);

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }
}
