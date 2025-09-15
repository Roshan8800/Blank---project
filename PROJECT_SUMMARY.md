# Project Summary: StudyFlow

This document provides a detailed summary of the StudyFlow web application, including its architecture, features, and key implementation details.

## 1. High-Level Overview

StudyFlow is a client-side productivity web application designed to help users organize their study schedules and track their progress. It uses modern web technologies like HTML5, Tailwind CSS, and vanilla JavaScript to create a responsive and interactive user experience. The application is designed to work offline by storing all user data locally in the browser's IndexedDB.

## 2. Technology Stack

-   **Frontend:** HTML, CSS, JavaScript
-   **Styling:** Tailwind CSS (via CDN)
-   **Icons:** Google Fonts (Inter, Noto Sans) and Material Symbols
-   **Local Storage:** IndexedDB
-   **Backend:** The application is architected to be offline-first but includes logic to sync with a backend API at `http://localhost:8080`.

## 3. Application Architecture

-   **Client-Side Logic:** All core logic resides in a single `script.js` file, which is deferred to prevent render-blocking. The script uses a modular pattern, with `setup` functions for each screen that only execute if the relevant DOM elements are present.
-   **Database:** The application uses IndexedDB with a database named `StudyflowDB_Tasks` (version 2). It contains three object stores:
    -   `tasks`: Stores all user-created events and tasks. Keyed by an auto-incrementing `id`.
    -   `tasks_outbox`: A temporary store for tasks that need to be synced with the backend.
    -   `goals`: Stores the user's short-term and long-term goals. Keyed by an `id` string (`'short-term'`, `'long-term'`).
-   **Offline-First:** Changes are first saved locally to IndexedDB, providing a seamless offline experience. The application then attempts to sync these changes with a backend API.

## 4. Feature Breakdown

### Planner Screen (`planner.html`)
-   **Default View:** This is the application's entry point.
-   **Dynamic Calendar:** Displays a monthly calendar. Users can navigate between months. The current day and selected day are highlighted.
-   **Event Management:** Users can add, edit, and delete events for any day via a modal and context menus. Events are stored in the `tasks` object store.

### Tasks Screen (`tasks.html`)
-   **Task List:** Displays all tasks, sorted by due date and then by completion status.
-   **Task Completion:** Users can toggle the completion status of tasks.

### Goals Screen (`goals.html`)
-   **Goal Setting:** Users can input and save short-term and long-term goals.
-   **Goal-to-Task Workflow:** A "Break down" feature allows users to take a goal and create actionable tasks from it on the Tasks screen.

### Progress Screen (`progress.html`)
-   **Dynamic Charts:** Displays statistics for "Tasks Completed" and "Time Spent". The data can be filtered by "Today", "Week", and "Month".
-   **SVG Charts:** The line graphs are dynamically generated using JavaScript to reflect the user's actual data.

### Focus Screen (`focus.html`)
-   **Pomodoro Timer:** A countdown timer to help users focus.
-   **Notifications:** The app requests permission to send browser notifications and alerts the user when a focus session is complete.
-   **Soundscapes Link:** Navigates to the Soundscapes screen.

### Soundscapes Screen (`sounds.html`)
-   **Ambient Sounds:** Provides a list of ambient sounds (e.g., Rain, Forest) that can be played during a focus session.
-   **Audio Playback:** A simple audio player handles play/pause logic, ensuring only one sound plays at a time. Uses placeholder audio files in the `/assets` directory.

## 5. Error Handling
-   The application uses a non-intrusive "toast" notification system to inform the user of events like successful saves or network errors.
