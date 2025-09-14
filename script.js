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
            // In a real app, include auth headers
            // headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            fetch(`${API_URL}/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            }).catch(err => {
                console.error('Failed to sync status update:', err);
                showToast('Failed to sync status. Will retry later.');
                // The change is already saved locally, so no need to revert.
            });
        };
    }

    // --- Syncing Logic ---
    async function syncOutbox() {
        if (!db) return Promise.resolve();
        const outboxTx = db.transaction('tasks_outbox', 'readonly');
        const outboxStore = outboxTx.objectStore('tasks_outbox');
        const getReq = outboxStore.getAll();

        return new Promise(resolve => {
            getReq.onsuccess = async (event) => {
                const outboxTasks = event.target.result;
                if (outboxTasks.length === 0) {
                    resolve();
                    return;
                }
                try {
                    // In a real app, include auth headers
                    const response = await fetch(`${API_URL}/tasks/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(outboxTasks),
                    });
                    if (response.ok) {
                        const deleteTx = db.transaction('tasks_outbox', 'readwrite');
                        deleteTx.objectStore('tasks_outbox').clear();
                        deleteTx.oncomplete = () => syncWithNetwork().then(resolve);
                    } else {
                        showToast('Could not sync all local changes.');
                        resolve();
                    }
                } catch (error) {
                    console.error('Network error during outbox sync.', error);
                    showToast('Sync failed. Check connection.');
                    resolve();
                }
            };
            getReq.onerror = () => resolve();
        });
    }

    async function syncWithNetwork() {
        try {
            // In a real app, include auth headers
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
            if (Notification.permission === 'granted') {
                new Notification('Focus session complete!', {
                    body: 'Great work! Time to take a break.',
                    icon: './assets/icon.png' // Note: This icon path may need to be adjusted
                });
            }
        }

        updateTimerDisplay();
        pauseButton.addEventListener('click', () => isPaused ? startTimer() : pauseTimer());
        stopButton.addEventListener('click', stopTimer);
    }

    // --- Planner Logic ---
    function setupPlanner() {
        const calendarGrid = document.querySelector('.grid.grid-cols-7.gap-y-2.text-center');
        if (!calendarGrid) return; // Only run on the planner page

        const monthYearDisplay = document.querySelector('.flex.items-center.justify-between.mb-4 p');
        const prevMonthButton = document.querySelector('.flex.items-center.justify-between.mb-4 button:first-child');
        const nextMonthButton = document.querySelector('.flex.items-center.justify-between.mb-4 button:last-child');
        const taskListContainer = document.querySelector('.flex.flex-col.gap-3.px-4.pb-24');

        let viewDate = new Date();
        let selectedDate = new Date();
        selectedDate.setHours(0, 0, 0, 0);

        function renderPlannerTask(task) {
            const taskElement = document.createElement('div');
            taskElement.className = 'flex items-center gap-4 p-4 rounded-xl bg-[#1E142A]';
            taskElement.innerHTML = `
                <div class="text-white flex items-center justify-center rounded-lg bg-[#362447] shrink-0 size-12">
                    <span class="material-symbols-outlined">${task.icon || 'task'}</span>
                </div>
                <div class="flex-1">
                    <p class="text-white font-medium">${task.title}</p>
                    <p class="text-[#ad93c8] text-sm">${task.startTime} - ${task.endTime}</p>
                </div>
                <button class="text-gray-400 hover:text-white">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
            `;
            return taskElement;
        }

        function displayPlannerTasks(date) {
            if (!db || !taskListContainer) return;
            const dateString = toYYYYMMDD(date);
            const todayHeader = taskListContainer.querySelector('h3');

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            if (date.getTime() === today.getTime()) {
                todayHeader.textContent = 'Today';
            } else if (date.getTime() === tomorrow.getTime()) {
                todayHeader.textContent = 'Tomorrow';
            } else {
                todayHeader.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            }

            const transaction = db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();

            request.onsuccess = (event) => {
                const allTasks = event.target.result;
                const tasksForDay = allTasks.filter(task => task.dueDate === dateString);

                taskListContainer.querySelectorAll('.bg-\\[\\#1E142A\\]').forEach(el => el.remove());
                const noTasksMsg = taskListContainer.querySelector('.no-tasks-message');
                if (noTasksMsg) noTasksMsg.remove();

                if (tasksForDay.length === 0) {
                    const noTasksElement = document.createElement('p');
                    noTasksElement.className = 'text-gray-400 text-center py-4 no-tasks-message';
                    noTasksElement.textContent = 'Nothing scheduled for this day.';
                    taskListContainer.appendChild(noTasksElement);
                } else {
                    tasksForDay.sort((a,b) => a.startTime.localeCompare(b.startTime)).forEach(task => {
                        const taskElement = renderPlannerTask(task);
                        taskListContainer.appendChild(taskElement);
                    });
                }
            };
        }

        function renderCalendar() {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            monthYearDisplay.textContent = `${viewDate.toLocaleString('default', { month: 'long' })} ${year}`;
            const firstDayOfMonth = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            calendarGrid.querySelectorAll('div, button').forEach(el => el.remove());

            for (let i = 0; i < firstDayOfMonth; i++) {
                calendarGrid.appendChild(document.createElement('div'));
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dayButton = document.createElement('button');
                dayButton.className = 'h-10 w-10 flex items-center justify-center text-white text-sm font-medium rounded-full hover:bg-[#362447]';
                dayButton.textContent = day;

                const thisDate = new Date(year, month, day);
                thisDate.setHours(0, 0, 0, 0);
                dayButton.dataset.date = thisDate.toISOString().split('T')[0];

                if (thisDate.getTime() === selectedDate.getTime()) {
                    dayButton.classList.add('bg-[#9643ea]');
                } else if (thisDate.getTime() === today.getTime()) {
                    dayButton.classList.add('bg-[#362447]');
                }
                calendarGrid.appendChild(dayButton);
            }
            displayPlannerTasks(selectedDate);
        }

        prevMonthButton.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() - 1);
            renderCalendar();
        });

        nextMonthButton.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() + 1);
            renderCalendar();
        });

        calendarGrid.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (target && target.dataset.date) {
                const [year, month, day] = target.dataset.date.split('-').map(Number);
                selectedDate = new Date(year, month - 1, day);
                selectedDate.setHours(0, 0, 0, 0);
                renderCalendar();
            }
        });

        renderCalendar();
    }

    // --- Mock Data Seeding ---
    const toYYYYMMDD = (d) => {
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    async function addMockData() {
        if (!db) return;
        const tx = db.transaction(['tasks'], 'readwrite');
        const store = tx.objectStore('tasks');
        const countReq = store.count();
        countReq.onsuccess = () => {
            if (countReq.result === 0) {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const MOCK_TASKS = [
                    { title: 'Math Study', dueDate: toYYYYMMDD(today), startTime: '10:00 AM', endTime: '11:00 AM', icon: 'auto_stories', status: 'todo' },
                    { title: 'Break', dueDate: toYYYYMMDD(today), startTime: '11:00 AM', endTime: '12:00 PM', icon: 'coffee', status: 'todo' },
                    { title: 'History Review', dueDate: toYYYYMMDD(today), startTime: '12:00 PM', endTime: '1:00 PM', icon: 'auto_stories', status: 'todo' },
                    { title: 'Lunch', dueDate: toYYYYMMDD(today), startTime: '1:00 PM', endTime: '2:00 PM', icon: 'restaurant', status: 'todo' },
                    { title: 'Science Project', dueDate: toYYYYMMDD(tomorrow), startTime: '2:00 PM', endTime: '3:00 PM', icon: 'science', status: 'todo' }
                ];
                MOCK_TASKS.forEach(task => store.add(task));
            }
        };
    }

    // --- Progress View Logic ---
    function setupProgressView() {
        const timeframeContainer = document.querySelector('input[name="timeframe"]')?.parentElement?.parentElement;
        if (!timeframeContainer) return;

        const tasksCompletedDisplay = document.getElementById('tasks-completed-value');
        const timeSpentDisplay = document.getElementById('time-spent-value');
        const timeframeLabels = document.querySelectorAll('.text-sm.text-\\[var\\(--secondary-300\\)\\]');

        function parseTime(timeStr) {
            if(!timeStr) return null;
            const [time, modifier] = timeStr.split(' ');
            if(!time || !modifier) return null;
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
            if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
            return { hours, minutes };
        }

        async function updateProgressView() {
            const selectedTimeframe = timeframeContainer.querySelector('input:checked').value;
            if (!db) return;

            const transaction = db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const allTasks = await new Promise(resolve => store.getAll().onsuccess = e => resolve(e.target.result));
            const doneTasks = allTasks.filter(task => task.status === 'done');

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            let filteredTasks = [];

            switch (selectedTimeframe) {
                case 'Today':
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    filteredTasks = doneTasks.filter(task => {
                        const taskDate = new Date(task.dueDate);
                        return taskDate > yesterday && taskDate <= now;
                    });
                    break;
                case 'Week':
                    const oneWeekAgo = new Date(today);
                    oneWeekAgo.setDate(today.getDate() - 6); // Start of the 7-day period including today
                    filteredTasks = doneTasks.filter(task => {
                        const taskDate = new Date(task.dueDate);
                        return taskDate >= oneWeekAgo && taskDate <= now;
                    });
                    break;
                case 'Month':
                    filteredTasks = doneTasks.filter(task => {
                        const taskDate = new Date(task.dueDate);
                        return taskDate.getFullYear() === now.getFullYear() && taskDate.getMonth() === now.getMonth();
                    });
                    break;
            }

            if(tasksCompletedDisplay) tasksCompletedDisplay.textContent = filteredTasks.length;

            let totalMinutes = 0;
            filteredTasks.forEach(task => {
                const start = parseTime(task.startTime);
                const end = parseTime(task.endTime);
                if (start && end) {
                    const diff = (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
                    if (diff > 0) totalMinutes += diff;
                }
            });

            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            if(timeSpentDisplay) timeSpentDisplay.textContent = `${hours}h ${minutes}m`;

            timeframeLabels.forEach(label => label.textContent = `This ${selectedTimeframe}`);
        }

        timeframeContainer.addEventListener('change', updateProgressView);
        updateProgressView();
    }

    // --- UI Utilities ---
    function showToast(message, type = 'error') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
        toast.className = `${bgColor} text-white text-sm font-medium px-4 py-2 rounded-lg shadow-md transition-all duration-300 transform translate-y-4 opacity-0`;
        toast.textContent = message;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
        }, 10);

        // Animate out and remove
        setTimeout(() => {
            toast.classList.add('opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 4000);
    }

    // --- Notifications Logic ---
    function setupNotifications() {
        const enableButton = document.getElementById('enable-notifications-button');
        if (!enableButton) return;

        if (!('Notification' in window)) {
            enableButton.textContent = 'Notifications not supported';
            enableButton.disabled = true;
            return;
        }

        enableButton.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                showToast('Notifications enabled!', 'success');
                new Notification('Studyflow', { body: 'You will now receive notifications.' });
                enableButton.style.display = 'none';
            } else {
                showToast('Notifications permission denied.');
            }
        });
    }

    // --- Main Execution ---
    async function main() {
        try {
            await openDatabase();
        } catch (error) {
            console.error('Fatal: Could not open database.', error);
            showToast('Error: Could not load local data.');
            return; // Stop execution if DB fails
        }

        await addMockData();
        await syncWithNetwork(); // This has its own error handling, no need to toast here
        await displayTasks();

        // setupViewSwitcher is no longer needed as navigation is handled by standard href links.
        setupPlanner(); // This will only run if planner elements are on the page
        setupFocusMode(); // This will only run if focus elements are on the page
        setupTaskCreation(); // This will only run if task elements are on the page
        setupProgressView(); // This will only run if progress elements are on the page
        setupNotifications(); // This will only run if notification elements are on the page
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
