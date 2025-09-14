// DOM Elements
const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const taskContentInput = document.getElementById('task-content');
const taskDueDateInput = document.getElementById('task-due-date');
const todoTasksContainer = document.getElementById('todo-tasks');
const inprogressTasksContainer = document.getElementById('inprogress-tasks');
const doneTasksContainer = document.getElementById('done-tasks');

const API_URL = 'http://localhost:8080';
let db;

// --- Database Functions ---
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StudyflowDB_Tasks', 1);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains('tasks')) {
                db.createObjectStore('tasks', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('tasks_outbox')) {
                db.createObjectStore('tasks_outbox', { autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

// --- Task Rendering ---
function renderTask(task) {
    const taskCard = document.createElement('div');
    taskCard.className = 'task-card';
    taskCard.setAttribute('data-id', task.id);
    taskCard.innerHTML = `
        <h3>${task.title}</h3>
        <p>${task.content}</p>
        ${task.dueDate ? `<p class="due-date">Due: ${task.dueDate}</p>` : ''}
        <select class="status-changer" onchange="updateTaskStatus(${task.id}, this.value)">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
            <option value="inprogress" ${task.status === 'inprogress' ? 'selected' : ''}>In Progress</option>
            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
    `;
    if (task.status === 'todo') todoTasksContainer.appendChild(taskCard);
    else if (task.status === 'inprogress') inprogressTasksContainer.appendChild(taskCard);
    else doneTasksContainer.appendChild(taskCard);
}

async function displayTasks() {
    todoTasksContainer.innerHTML = '';
    inprogressTasksContainer.innerHTML = '';
    doneTasksContainer.innerHTML = '';

    const transaction = db.transaction(['tasks'], 'readonly');
    const store = transaction.objectStore('tasks');
    const request = store.getAll();

    request.onsuccess = (event) => {
        const tasks = event.target.result;
        tasks.forEach(renderTask);
    };
    request.onerror = (event) => console.error('Error fetching tasks from IDB:', event.target.error);
}

// --- Task Actions ---
taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const task = {
        title: taskTitleInput.value,
        content: taskContentInput.value,
        dueDate: taskDueDateInput.value,
        status: 'todo'
    };

    const outboxTx = db.transaction(['tasks_outbox'], 'readwrite');
    outboxTx.objectStore('tasks_outbox').add(task);
    outboxTx.oncomplete = () => {
        taskForm.reset();
        syncOutbox(); // Attempt to sync immediately
        // Optimistic rendering
        renderTask({id: 'temp-' + new Date().getTime(), ...task});
    };
});

async function updateTaskStatus(id, newStatus) {
    const tx = db.transaction(['tasks'], 'readwrite');
    const store = tx.objectStore('tasks');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
        const task = getReq.result;
        task.status = newStatus;
        store.put(task);
    };

    tx.oncomplete = () => {
        // More efficient DOM update instead of re-rendering everything
        const taskCard = document.querySelector(`.task-card[data-id='${id}']`);
        if (taskCard) {
            if (newStatus === 'todo') todoTasksContainer.appendChild(taskCard);
            else if (newStatus === 'inprogress') inprogressTasksContainer.appendChild(taskCard);
            else doneTasksContainer.appendChild(taskCard);
        }

        // Also send update to backend
        fetch(`${API_URL}/tasks/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        }).catch(err => console.error('Failed to sync status update:', err));
    };
}


// --- Syncing Logic ---
async function syncOutbox() {
    const outboxTx = db.transaction('tasks_outbox', 'readonly');
    const outboxStore = outboxTx.objectStore('tasks_outbox');
    const getReq = outboxStore.openCursor();
    const syncedKeys = [];

    getReq.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const task = cursor.value;
            try {
                const response = await fetch(`${API_URL}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task),
                });
                if (response.ok) {
                    syncedKeys.push(cursor.primaryKey);
                } else {
                     console.error('Failed to sync a task, will retry later.', await response.text());
                }
            } catch (error) {
                console.error('Network error during outbox sync. Will retry later.', error);
                // Stop trying if network is down
                return;
            }
            cursor.continue();
        } else {
            // End of cursor, now delete synced items
            if (syncedKeys.length > 0) {
                const deleteTx = db.transaction('tasks_outbox', 'readwrite');
                const deleteStore = deleteTx.objectStore('tasks_outbox');
                syncedKeys.forEach(key => deleteStore.delete(key));
                deleteTx.oncomplete = () => {
                    console.log(`${syncedKeys.length} tasks synced successfully from outbox.`);
                    syncWithNetwork(); // Refresh data from network
                };
            }
        }
    };
}

async function syncWithNetwork() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        if (!response.ok) throw new Error('Network request failed');

        const tasks = await response.json();
        const tx = db.transaction(['tasks'], 'readwrite');
        const store = tx.objectStore('tasks');
        store.clear();
        tasks.forEach(task => store.add(task));

        tx.oncomplete = displayTasks;

    } catch (error) {
        console.log('App is likely offline. Could not sync with network.');
    }
}

// --- Main ---
async function main() {
    await openDatabase();
    await displayTasks();
    await syncOutbox();
    await syncWithNetwork();
}

main();

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('ServiceWorker registration successful.'))
            .catch(err => console.error('ServiceWorker registration failed: ', err));
    });
}
