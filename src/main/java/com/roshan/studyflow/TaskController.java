package com.roshan.studyflow;

import com.google.gson.Gson;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

import static spark.Spark.*;

public class TaskController {

    private final Gson gson = new Gson();

    public void registerRoutes() {
        // Get all tasks
        get("/tasks", (req, res) -> {
            res.type("application/json");
            return gson.toJson(getAllTasks());
        });

        // Create a new task
        post("/tasks", (req, res) -> {
            res.type("application/json");
            Task newTask = gson.fromJson(req.body(), Task.class);
            createTask(newTask);
            res.status(201);
            return gson.toJson(newTask);
        });

        // Update a task's status
        put("/tasks/:id/status", (req, res) -> {
            res.type("application/json");
            int id = Integer.parseInt(req.params(":id"));
            StatusUpdateRequest statusUpdate = gson.fromJson(req.body(), StatusUpdateRequest.class);
            updateTaskStatus(id, statusUpdate.getStatus());
            return "{\"message\":\"Status updated successfully\"}";
        });
    }

    private static class StatusUpdateRequest {
        private String status;
        public String getStatus() { return status; }
    }

    private List<Task> getAllTasks() {
        List<Task> tasks = new ArrayList<>();
        String sql = "SELECT * FROM tasks";
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {
                tasks.add(new Task(
                        rs.getInt("id"),
                        rs.getString("title"),
                        rs.getString("content"),
                        rs.getString("status"),
                        rs.getString("dueDate")
                ));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return tasks;
    }

    private void createTask(Task task) {
        String sql = "INSERT INTO tasks (title, content, status, dueDate) VALUES (?, ?, ?, ?)";
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            pstmt.setString(1, task.getTitle());
            pstmt.setString(2, task.getContent());
            pstmt.setString(3, task.getStatus());
            pstmt.setString(4, task.getDueDate());
            pstmt.executeUpdate();

            ResultSet generatedKeys = pstmt.getGeneratedKeys();
            if (generatedKeys.next()) {
                task.setId(generatedKeys.getInt(1));
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    private void updateTaskStatus(int id, String status) {
        String sql = "UPDATE tasks SET status = ? WHERE id = ?";
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, status);
            pstmt.setInt(2, id);
            pstmt.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
