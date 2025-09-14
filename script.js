const noteForm = document.getElementById('note-form');
const noteTitleInput = document.getElementById('note-title');
const noteContentInput = document.getElementById('note-content');
const notesContainer = document.getElementById('notes-container');

const API_URL = 'http://localhost:8080';

let db;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('StudyflowDB', 2);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains('notes')) {
                db.createObjectStore('notes', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('outbox')) {
                db.createObjectStore('outbox', { autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };
    });
}

noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addNote();
});

async function addNote() {
    const title = noteTitleInput.value;
    const content = noteContentInput.value;

    if (title.trim() === '' || content.trim() === '') {
        return;
    }

    const note = { title, content };

    try {
        const response = await fetch(`${API_URL}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note),
        });

        if (response.ok) {
            const newNote = await response.json();
            const transaction = db.transaction(['notes'], 'readwrite');
            const objectStore = transaction.objectStore('notes');
            objectStore.add(newNote);
            transaction.oncomplete = () => {
                noteTitleInput.value = '';
                noteContentInput.value = '';
                displayNotes();
            };
        } else {
            throw new Error('Request failed');
        }
    } catch (error) {
        console.log('App is offline. Saving note to outbox.');
        const transaction = db.transaction(['outbox'], 'readwrite');
        const objectStore = transaction.objectStore('outbox');
        objectStore.add(note);
        transaction.oncomplete = () => {
            // Optimistically render the note
            renderNote({id: 'temp-' + new Date().getTime(), ...note});
            noteTitleInput.value = '';
            noteContentInput.value = '';
        }
    }
}

async function displayNotes() {
    notesContainer.innerHTML = '';
    const transaction = db.transaction(['notes'], 'readonly');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
        const notes = event.target.result;
        notes.forEach(renderNote);
    };
    request.onerror = (event) => {
        console.error('Error fetching notes from IDB:', event.target.error);
    };
}

function renderNote(note) {
    const noteElement = document.createElement('div');
    noteElement.classList.add('note');
    noteElement.innerHTML = `
        <h2>${note.title}</h2>
        <p>${note.content}</p>
        <button onclick="deleteNote(${note.id})">Delete</button>
    `;
    notesContainer.appendChild(noteElement);
}


async function deleteNote(id) {
    // Don't delete optimistic notes
    if (typeof id === 'string' && id.startsWith('temp-')) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/notes/${id}`, {
            method: 'DELETE',
        });
        if (response.ok) {
            const transaction = db.transaction(['notes'], 'readwrite');
            const objectStore = transaction.objectStore('notes');
            objectStore.delete(id);
            transaction.oncomplete = () => {
                displayNotes();
            };
        } else {
            console.error('Error deleting note:', response.statusText);
        }
    } catch (error) {
        console.error('Error deleting note:', error);
    }
}

async function main() {
    await openDatabase();
    displayNotes();
    await syncOutbox();
    syncWithNetwork();
}

async function syncOutbox() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['outbox'], 'readwrite');
        const objectStore = transaction.objectStore('outbox');
        const request = objectStore.getAll();

        request.onsuccess = async (event) => {
            const outboxNotes = event.target.result;
            if (outboxNotes.length === 0) {
                resolve();
                return;
            }
            console.log(`Syncing ${outboxNotes.length} notes from outbox...`);
            for (const note of outboxNotes) {
                try {
                    const response = await fetch(`${API_URL}/notes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(note),
                    });
                    if (response.ok) {
                        // Note synced, remove from outbox
                        // This requires a new transaction, or careful handling of keys.
                        // For simplicity, we clear the whole outbox after the loop.
                    }
                } catch (error) {
                    console.error('Failed to sync a note, will retry later.', error);
                }
            }
            // Clear the outbox after attempting to sync all notes
            const clearTransaction = db.transaction(['outbox'], 'readwrite');
            clearTransaction.objectStore('outbox').clear();
            clearTransaction.oncomplete = () => resolve();
            clearTransaction.onerror = (event) => reject(event.target.error);
        };
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function syncWithNetwork() {
    try {
        const response = await fetch(`${API_URL}/notes`);
        if (!response.ok) {
            console.error('Error fetching notes from network:', response.statusText);
            return;
        }
        const notes = await response.json();

        const transaction = db.transaction(['notes'], 'readwrite');
        const objectStore = transaction.objectStore('notes');
        objectStore.clear();
        notes.forEach(note => {
            objectStore.add(note);
        });

        transaction.oncomplete = () => {
            displayNotes();
        };
        transaction.onerror = (event) => {
            console.error('Error saving notes to IDB:', event.target.error);
        };

    } catch (error) {
        console.log('App is likely offline. Could not sync with network.');
    }
}

main();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch((error) => {
                console.error('ServiceWorker registration failed: ', error);
            });
    });
}
