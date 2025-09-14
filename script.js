document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskContentInput = document.getElementById('task-content');
    const taskDueDateInput = document.getElementById('task-due-date');
    const addTaskButton = document.querySelector('#tasks-view header button:last-child');
    const addTaskModal = document.getElementById('add-task-modal');
    const cancelTaskButton = document.getElementById('cancel-task-button');

    const API_URL = 'http://localhost:8080';
    let db;

    // --- Database Functions ---
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StudyflowDB_Tasks', 1);
            request.onupgradeneeded = (event) => {
                db = event.target.result;
                if (!db.objectStoreNames.contains('tasks')) {
                    // Use autoIncrementing key for simplicity
                    db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
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
        const taskContainer = document.querySelector('#tasks-view main');
        if (!taskContainer) return;
        const taskElement = document.createElement('div');
        taskElement.className = 'flex items-center gap-4 bg-[#1C1326] px-4 min-h-[72px] py-3 rounded-2xl';
        taskElement.setAttribute('data-id', task.id);
        const isCompleted = task.status === 'done';
        let dueDateText = 'No due date';
        if (task.dueDate) {
            const today = new Date();
            const dueDate = new Date(task.dueDate);
            today.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 0) dueDateText = 'Due Today';
            else if (diffDays === 1) dueDateText = 'Due Tomorrow';
            else if (diffDays > 1) dueDateText = `Due in ${diffDays} days`;
            else dueDateText = `Overdue`;
        }
        taskElement.innerHTML = `
            <div class="flex size-7 items-center justify-center">
                <input type="checkbox" ${isCompleted ? 'checked' : ''} class="task-checkbox h-6 w-6 rounded-full border-[#4d3465] border-2 bg-transparent text-[#9643ea] checked:bg-[#9643ea] checked:border-[#9643ea] checked:bg-[image:--checkbox-tick-svg] focus:ring-0 focus:ring-offset-0 focus:border-[#4d3465] focus:outline-none"/>
            </div>
            <div class="flex flex-col justify-center">
                <p class="text-white text-base font-medium leading-normal ${isCompleted ? 'line-through' : ''}">${task.title}</p>
                <p class="text-[#ad93c8] text-sm font-normal leading-normal">${dueDateText}</p>
            </div>
        `;
        taskContainer.appendChild(taskElement);
    }

    // --- Task Display & Event Handling ---
    async function displayTasks() {
        const taskContainer = document.querySelector('#tasks-view main');
        if (!taskContainer || !db) return;
        taskContainer.innerHTML = '';
        const transaction = db.transaction(['tasks'], 'readonly');
        const store = transaction.objectStore('tasks');
        const request = store.getAll();
        request.onsuccess = (event) => {
            const tasks = event.target.result;
            tasks.sort((a, b) => (a.status === 'done') - (b.status === 'done'));
            tasks.forEach(renderTask);
            const taskElements = document.querySelectorAll('#tasks-view main > div[data-id]');
            taskElements.forEach(taskElement => {
                const checkbox = taskElement.querySelector('.task-checkbox');
                const taskId = taskElement.getAttribute('data-id');
                if (checkbox && taskId) {
                    checkbox.addEventListener('change', (e) => {
                        const isCompleted = e.target.checked;
                        const numericTaskId = parseInt(taskId, 10);
                        if (!isNaN(numericTaskId)) {
                            updateTaskStatus(numericTaskId, isCompleted);
                        }
                        const titleElement = taskElement.querySelector('p.text-white');
                        if (titleElement) {
                            titleElement.classList.toggle('line-through', isCompleted);
                        }
                    });
                }
            });
        };
        request.onerror = (event) => console.error('Error fetching tasks from IDB:', event.target.error);
    }

    // --- Task Actions ---
    function setupTaskCreation() {
        if (addTaskButton && addTaskModal && cancelTaskButton && taskForm) {
            addTaskButton.addEventListener('click', () => addTaskModal.classList.remove('hidden'));
            cancelTaskButton.addEventListener('click', () => addTaskModal.classList.add('hidden'));
            taskForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const task = {
                    title: taskTitleInput.value,
                    content: taskContentInput.value || '',
                    dueDate: taskDueDateInput.value,
                    status: 'todo'
                };

                // Add to the main tasks store for immediate UI update
                const tasksTx = db.transaction(['tasks'], 'readwrite');
                const tasksStore = tasksTx.objectStore('tasks');
                const addRequest = tasksStore.add(task);

                addRequest.onsuccess = () => {
                    // Also add to the outbox for background syncing
                    const outboxTx = db.transaction(['tasks_outbox'], 'readwrite');
                    outboxTx.objectStore('tasks_outbox').add(task);
                    outboxTx.oncomplete = () => {
                        // Sync in the background, don't wait for it
                        syncOutbox();
                    }

                    // Refresh the UI from the database, which now contains the new task
                    displayTasks();
                };

                // Reset form and hide modal immediately
                taskForm.reset();
                addTaskModal.classList.add('hidden');
            });
        }
    }

    async function updateTaskStatus(taskId, isCompleted) {
        const newStatus = isCompleted ? 'done' : 'todo';
        if (!db) return;
        const tx = db.transaction(['tasks'], 'readwrite');
        const store = tx.objectStore('tasks');
        const getReq = store.get(taskId);
        getReq.onsuccess = () => {
            const task = getReq.result;
            if (task) {
                task.status = newStatus;
                store.put(task);
            }
        };
        tx.oncomplete = () => {
            fetch(`${API_URL}/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            }).catch(err => console.error('Failed to sync status update:', err));
        };
    }

    // --- Syncing Logic ---
    async function syncOutbox() {
        if (!db) return Promise.resolve();
        const outboxTx = db.transaction('tasks_outbox', 'readonly');
        const outboxStore = outboxTx.objectStore('tasks_outbox');
        const getReq = outboxStore.getAll(); // More efficient to get all at once

        return new Promise(resolve => {
            getReq.onsuccess = async (event) => {
                const outboxTasks = event.target.result;
                if (outboxTasks.length === 0) {
                    resolve();
                    return;
                }
                try {
                    const response = await fetch(`${API_URL}/tasks/sync`, { // Assuming a bulk endpoint
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(outboxTasks),
                    });
                    if (response.ok) {
                        const deleteTx = db.transaction('tasks_outbox', 'readwrite');
                        deleteTx.objectStore('tasks_outbox').clear();
                        deleteTx.oncomplete = () => syncWithNetwork().then(resolve);
                    } else {
                        resolve(); // Resolve even if sync fails to not block UI
                    }
                } catch (error) {
                    console.error('Network error during outbox sync.', error);
                    resolve();
                }
            };
            getReq.onerror = () => resolve();
        });
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
            return new Promise(resolve => {
                tx.oncomplete = () => resolve();
            });
        } catch (error) {
            console.log('App is likely offline. Could not sync with network.');
            return Promise.resolve();
        }
    }

    // --- Focus Mode Logic ---
    function setupFocusMode() {
        const timerDisplay = document.getElementById('timer-display');
        const pauseButton = document.getElementById('pause-button');
        const stopButton = document.getElementById('stop-button');
        const progressCircle = document.getElementById('progress-circle');
        if(!timerDisplay || !pauseButton || !stopButton || !progressCircle) return;

        const circleLength = 2 * Math.PI * 45;
        let timerInterval = null;
        let totalSeconds = 25 * 60;
        let isPaused = true;

        function updateTimerDisplay() {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            const progress = totalSeconds / (25 * 60);
            progressCircle.style.strokeDashoffset = circleLength * (1 - progress);
        }

        function startTimer() {
            if (isPaused) {
                isPaused = false;
                pauseButton.textContent = 'Pause';
                timerInterval = setInterval(() => {
                    if (totalSeconds > 0) {
                        totalSeconds--;
                        updateTimerDisplay();
                    } else {
                        stopTimer();
                    }
                }, 1000);
            }
        }

        function pauseTimer() {
            isPaused = true;
            pauseButton.textContent = 'Start';
            clearInterval(timerInterval);
        }

        function stopTimer() {
            isPaused = true;
            clearInterval(timerInterval);
            totalSeconds = 25 * 60;
            updateTimerDisplay();
            pauseButton.textContent = 'Start';
        }

        updateTimerDisplay();
        pauseButton.addEventListener('click', () => isPaused ? startTimer() : pauseTimer());
        stopButton.addEventListener('click', stopTimer);
    }

    // --- View Switching ---
    function setupViewSwitcher() {
        const navLinks = document.querySelectorAll('nav a');
        const views = document.querySelectorAll('.view');
        function updateNavStyles(activeLink) {
            if (!activeLink) return;
            navLinks.forEach(nav => {
                nav.classList.remove('text-white', 'bg-[#9643ea]/20', 'rounded-full');
                nav.classList.add('text-[#ad93c8]');
                const label = nav.querySelector('p');
                if (label) {
                    label.classList.remove('font-bold');
                    label.classList.add('font-medium');
                }
            });
            activeLink.classList.add('text-white', 'bg-[#9643ea]/20', 'rounded-full');
            activeLink.classList.remove('text-[#ad93c8]');
            const activeLabel = activeLink.querySelector('p');
            if (activeLabel) {
                activeLabel.classList.add('font-bold');
                activeLabel.classList.remove('font-medium');
            }
        }
        navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const viewName = link.getAttribute('data-view');
                const targetView = document.getElementById(`${viewName}-view`);
                if (targetView) {
                    views.forEach(view => view.classList.remove('active'));
                    targetView.classList.add('active');
                    updateNavStyles(link);
                    if (viewName === 'focus') {
                        setupFocusMode();
                    }
                }
            });
        });
        const initialActiveView = document.querySelector('.view.active');
        if (initialActiveView) {
            const initialViewName = initialActiveView.id.replace('-view', '');
            const initialActiveLink = document.querySelector(`nav a[data-view="${initialViewName}"]`);
            updateNavStyles(initialActiveLink);
        }
    }

    // --- Main Execution ---
    async function main() {
        await openDatabase();
        await syncWithNetwork();
        await displayTasks();
        setupViewSwitcher();
        setupFocusMode(); // Initial setup for focus view if it's active
        setupTaskCreation();
    }

    main();
});

// Service Worker (kept outside DOMContentLoaded)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('ServiceWorker registration successful.'))
            .catch(err => console.error('ServiceWorker registration failed: ', err));
    });
}
