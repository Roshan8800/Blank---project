const noteForm = document.getElementById('note-form');
const noteTitleInput = document.getElementById('note-title');
const noteContentInput = document.getElementById('note-content');
const notesContainer = document.getElementById('notes-container');

let db;
const request = indexedDB.open('StudyflowDB', 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    displayNotes();
};

request.onerror = (event) => {
    console.error('Database error:', event.target.error);
};

noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addNote();
});

function addNote() {
    const title = noteTitleInput.value;
    const content = noteContentInput.value;

    if (title.trim() === '' || content.trim() === '') {
        return;
    }

    const transaction = db.transaction(['notes'], 'readwrite');
    const objectStore = transaction.objectStore('notes');
    const note = { title, content };
    const request = objectStore.add(note);

    request.onsuccess = () => {
        noteTitleInput.value = '';
        noteContentInput.value = '';
        displayNotes();
    };

    request.onerror = (event) => {
        console.error('Error adding note:', event.target.error);
    };
}

function displayNotes() {
    notesContainer.innerHTML = '';
    const transaction = db.transaction(['notes'], 'readonly');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
        const notes = event.target.result;
        notes.forEach((note) => {
            const noteElement = document.createElement('div');
            noteElement.classList.add('note');
            noteElement.innerHTML = `
                <h2>${note.title}</h2>
                <p>${note.content}</p>
                <button onclick="deleteNote(${note.id})">Delete</button>
            `;
            notesContainer.appendChild(noteElement);
        });
    };

    request.onerror = (event) => {
        console.error('Error displaying notes:', event.target.error);
    };
}

function deleteNote(id) {
    const transaction = db.transaction(['notes'], 'readwrite');
    const objectStore = transaction.objectStore('notes');
    const request = objectStore.delete(id);

    request.onsuccess = () => {
        displayNotes();
    };

    request.onerror = (event) => {
        console.error('Error deleting note:', event.target.error);
    };
}

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
