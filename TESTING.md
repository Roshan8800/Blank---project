# Testing the Studyflow Application

This document provides instructions on how to run and test the integrated Studyflow application, which consists of a Java backend and a JavaScript frontend.

## 1. Running the Backend

The backend is a Java application built with Maven.

1.  **Navigate to the project root directory** in your terminal.

2.  **Package the application** into an executable JAR file using Maven:
    ```bash
    mvn package
    ```
    This command will compile the code, run any tests, and package it into a "fat JAR" in the `target/` directory.

3.  **Run the backend server**:
    ```bash
    java -jar target/studyflow-backend-1.0-SNAPSHOT.jar
    ```
    The backend server will start and listen on `http://localhost:8080`. You should see some log output in your terminal.

## 2. Running the Frontend

The frontend is a set of static files (`index.html`, `style.css`, `script.js`). To run it, you need a simple HTTP server.

1.  **Open a new terminal window** and navigate to the same project root directory.

2.  **Start a simple HTTP server.** If you have Python installed, you can use its built-in server.

    For Python 3:
    ```bash
    python -m http.server 8000
    ```

    For Python 2:
    ```bash
    python -m SimpleHTTPServer 8000
    ```

    This will serve the files in the current directory on `http://localhost:8000`.

## 3. Testing the Application

1.  **Open your web browser** and navigate to the frontend URL: `http://localhost:8000`.

2.  You should see the **Studyflow application interface** with a form to add notes and a section for the list of notes.

3.  **Test adding a note:**
    -   Fill in the "Note title" and "Note content" fields.
    -   Click the "Add Note" button.
    -   The note should appear in the list below the form.

4.  **Test deleting a note:**
    -   Click the "Delete" button on a note.
    -   The note should be removed from the list.

5.  **Check for errors:**
    -   Open your browser's developer console (usually by pressing F12) to check for any frontend errors.
    -   Check the terminal where you are running the Java backend for any server-side errors.

## 4. Testing Offline Functionality

This application is designed to work even when you are offline.

1.  **Go offline:**
    -   Open your browser's developer tools (F12).
    -   Go to the "Network" tab.
    -   Find the network throttling dropdown (it might say "No throttling" or "Online").
    -   Select "Offline".

2.  **Add a note while offline:**
    -   With your browser in offline mode, add a new note using the form.
    -   The note should appear in the list immediately. This is an "optimistic" update. The note is saved locally in your browser's IndexedDB.

3.  **Go back online:**
    -   In the Network tab of the developer tools, switch the throttling back to "Online" (or disable it).

4.  **Refresh and verify sync:**
    -   Refresh the page.
    -   The application will first load the notes from your local database (including the one you just added).
    -   Then, it will sync with the backend. You should see in the developer console logs that it is "Syncing X notes from outbox...".
    -   After the sync, the list will refresh, and your new note will now have a permanent ID from the server.
