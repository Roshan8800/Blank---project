package com.roshan.studyflow;

public class Task {
    private int id;
    private String title;
    private String content;
    private String status; // e.g., "todo", "inprogress", "done"
    private String dueDate;

    public Task(int id, String title, String content, String status, String dueDate) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.status = status;
        this.dueDate = dueDate;
    }

    // Getters and setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }
}
