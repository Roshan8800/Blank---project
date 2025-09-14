package com.studyflow;

import com.google.gson.Gson;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

import static spark.Spark.*;

public class NoteController {

    private final Gson gson = new Gson();

    public void registerRoutes() {
        // Get all notes
        get("/notes", (req, res) -> {
            res.type("application/json");
            return gson.toJson(getAllNotes());
        });

        // Get a single note by id
        get("/notes/:id", (req, res) -> {
            res.type("application/json");
            int id = Integer.parseInt(req.params(":id"));
            Note note = getNoteById(id);
            if (note != null) {
                return gson.toJson(note);
            } else {
                res.status(404);
                return "{\"error\":\"Note not found\"}";
            }
        });

        // Create a new note
        post("/notes", (req, res) -> {
            res.type("application/json");
            Note newNote = gson.fromJson(req.body(), Note.class);
            createNote(newNote);
            res.status(201);
            return gson.toJson(newNote);
        });

        // Update a note
        put("/notes/:id", (req, res) -> {
            res.type("application/json");
            int id = Integer.parseInt(req.params(":id"));
            Note updatedNote = gson.fromJson(req.body(), Note.class);
            updateNote(id, updatedNote);
            return gson.toJson(updatedNote);
        });

        // Delete a note
        delete("/notes/:id", (req, res) -> {
            res.type("application/json");
            int id = Integer.parseInt(req.params(":id"));
            deleteNote(id);
            res.status(204);
            return "";
        });
    }

    private List<Note> getAllNotes() {
        List<Note> notes = new ArrayList<>();
        String sql = "SELECT * FROM notes";
        try (Connection conn = Database.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {
                notes.add(new Note(
                        rs.getInt("id"),
                        rs.getString("title"),
                        rs.getString("content")
                ));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return notes;
    }

    private Note getNoteById(int id) {
        String sql = "SELECT * FROM notes WHERE id = ?";
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, id);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return new Note(
                        rs.getInt("id"),
                        rs.getString("title"),
                        rs.getString("content")
                );
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }


    private void createNote(Note note) {
        String sql = "INSERT INTO notes (title, content) VALUES (?, ?)";
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            pstmt.setString(1, note.getTitle());
            pstmt.setString(2, note.getContent());
            pstmt.executeUpdate();

            ResultSet generatedKeys = pstmt.getGeneratedKeys();
            if (generatedKeys.next()) {
                note.setId(generatedKeys.getInt(1));
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    private void updateNote(int id, Note note) {
        String sql = "UPDATE notes SET title = ?, content = ? WHERE id = ?";
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, note.getTitle());
            pstmt.setString(2, note.getContent());
            pstmt.setInt(3, id);
            pstmt.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    private void deleteNote(int id) {
        String sql = "DELETE FROM notes WHERE id = ?";
        try (Connection conn = Database.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, id);
            pstmt.executeUpdate();
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}
