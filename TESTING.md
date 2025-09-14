# Testing the Studyflow Application

This document provides instructions on how to run and test the integrated Studyflow application, which now features a task management board.

## 1. Running the Backend

The backend is a Java application built with Maven.

1.  **Navigate to the project root directory** in your terminal.

2.  **Package the application** into an executable JAR file using Maven:
    ```bash
    mvn package
    ```
    This command will compile the code and package it into a "fat JAR" in the `target/` directory.

3.  **Run the backend server**:
    ```bash
    java -jar target/studyflow-backend-1.0-SNAPSHOT.jar
    ```
    The backend server will start and listen on `http://localhost:8080`.

## 2. Running the Frontend

The frontend is a set of static files. To run it, you need a simple HTTP server.

1.  **Open a new terminal window** and navigate to the same project root directory.

2.  **Start a simple HTTP server.** If you have Python installed, you can use its built-in server.

    For Python 3:
    ```bash
    python -m http.server 8000
    ```

    This will serve the files in the current directory on `http://localhost:8000`.

## 3. Testing the Task Management Feature

1.  **Open your web browser** and navigate to the frontend URL: `http://localhost:8000`.

2.  You should see the **Studyflow task board** with three columns: "To Do", "In Progress", and "Done".

3.  **Test adding a task:**
    -   Fill in the "Task title", "Task details", and "Due date" fields in the form.
    -   Click the "Add Task" button.
    -   The task should appear in the "To Do" column.

4.  **Test changing a task's status:**
    -   Find a task card.
    -   Use the dropdown menu on the card to change its status (e.g., from "To Do" to "In Progress").
    -   The task card should move to the correct column.

## 4. Testing Offline Functionality

1.  **Go offline:**
    -   Open your browser's developer tools (F12) and go to the "Network" tab.
    -   Select "Offline" from the network throttling dropdown.

2.  **Add a task while offline:**
    -   With your browser in offline mode, add a new task.
    -   The task should appear in the "To Do" column immediately. This demonstrates the optimistic UI update and offline storage.

3.  **Go back online:**
    -   In the developer tools, switch the network back to "Online".

4.  **Refresh and verify sync:**
    -   Refresh the page.
    -   The application will sync the offline-created task with the backend. You should see console logs indicating the sync is happening.
    -   The task you created offline will now be permanently saved and will appear just like any other task.
