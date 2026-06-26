// ===== КОНФИГУРАЦИЯ FIREBASE =====
// ЗАМЕНИТЕ НА СВОИ ДАННЫЕ ИЗ КОНСОЛИ FIREBASE!
const firebaseConfig = {
    apiKey: "ВАШ_API_KEY",
    authDomain: "ВАШ_ПРОЕКТ.firebaseapp.com",
    projectId: "ВАШ_ПРОЕКТ",
    storageBucket: "ВАШ_ПРОЕКТ.appspot.com",
    messagingSenderId: "ВАШ_SENDER_ID",
    appId: "ВАШ_APP_ID"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== DOM ЭЛЕМЕНТЫ =====
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');
const authMessage = document.getElementById('auth-message');
const tasksContainer = document.getElementById('tasks-container');
const statsText = document.getElementById('stats-text');

// ===== СОСТОЯНИЕ =====
let currentUser = null;
let currentFilter = 'all';
let tasks = [];

// ===== АВТОРИЗАЦИЯ =====

// Вход
function login(email, password) {
    showAuthMessage('');
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            showAuthMessage(getAuthErrorText(error.code), 'error');
        });
}

// Регистрация
function register(email, password) {
    showAuthMessage('');
    if (password.length < 6) {
        showAuthMessage('Пароль должен быть минимум 6 символов', 'error');
        return;
    }
    auth.createUserWithEmailAndPassword(email, password)
        .catch(error => {
            showAuthMessage(getAuthErrorText(error.code), 'error');
        });
}

// Выход
function logout() {
    auth.signOut();
}

// Обработка ошибок авторизации
function getAuthErrorText(code) {
    const errors = {
        'auth/invalid-email': 'Неверный формат email',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
        'auth/email-already-in-use': 'Email уже используется',
        'auth/weak-password': 'Пароль слишком простой',
        'auth/invalid-credential': 'Неверный email или пароль'
    };
    return errors[code] || 'Ошибка: ' + code;
}

function showAuthMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = 'message' + (type ? ' ' + type : '');
}

// ===== ЗАДАЧИ =====

// Получение коллекции задач пользователя
function getTasksRef() {
    return db.collection('users').doc(currentUser.uid).collection('tasks');
}

// Загрузка задач
function loadTasks() {
    if (!currentUser) return;

    tasksContainer.innerHTML = '<div class="loading">Загрузка задач...</div>';

    getTasksRef()
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            tasks = [];
            snapshot.forEach(doc => {
                tasks.push({ id: doc.id, ...doc.data() });
            });
            renderTasks();
            updateStats();
        }, error => {
            console.error('Ошибка загрузки задач:', error);
            tasksContainer.innerHTML = '<div class="empty-state"><div class="emoji">⚠️</div>Ошибка загрузки задач</div>';
        });
}

// Добавление задачи
function addTask(title, desc, priority) {
    if (!currentUser) return;

    const task = {
        title: title.trim(),
        description: desc.trim(),
        priority: priority,
        completed: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    getTasksRef().add(task)
        .catch(error => console.error('Ошибка добавления:', error));
}

// Переключение статуса
function toggleTask(id, completed) {
    if (!currentUser) return;
    getTasksRef().doc(id).update({ completed: !completed })
        .catch(error => console.error('Ошибка обновления:', error));
}

// Удаление задачи
function deleteTask(id) {
    if (!currentUser) return;
    if (!confirm('Удалить задачу?')) return;
    getTasksRef().doc(id).delete()
        .catch(error => console.error('Ошибка удаления:', error));
}

// Обновление задачи
function updateTask(id, data) {
    if (!currentUser) return;
    getTasksRef().doc(id).update(data)
        .catch(error => console.error('Ошибка обновления:', error));
}

// ===== РЕНДЕРИНГ =====

function renderTasks() {
    const filtered = tasks.filter(t => {
        if (currentFilter === 'active') return !t.completed;
        if (currentFilter === 'completed') return t.completed;
        return true;
    });

    if (filtered.length === 0) {
        tasksContainer.innerHTML = `
            <div class="empty-state">
                <div class="emoji">📝</div>
                <div>${currentFilter === 'all' ? 'Нет задач. Добавьте первую!' : 'Нет задач в этой категории'}</div>
            </div>`;
        return;
    }

    tasksContainer.innerHTML = filtered.map(task => `
        <div class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''}">
            <input type="checkbox" class="task-checkbox" 
                ${task.completed ? 'checked' : ''} 
                onchange="toggleTask('${task.id}', ${task.completed})">
            <div class="task-content">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span class="priority-badge ${task.priority}">${getPriorityLabel(task.priority)}</span>
                    <span class="task-date">${formatDate(task.createdAt)}</span>
                </div>
            </div>
            <div class="task-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('${task.id}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    const total = tasks.length;
    const active = tasks.filter(t => !t.completed).length;
    const completed = tasks.filter(t => t.completed).length;
    statsText.textContent = `Всего: ${total} | Активных: ${active} | Выполнено: ${completed}`;
}

function getPriorityLabel(p) {
    const labels = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
    return labels[p] || p;
}

function formatDate(ts) {
    if (!ts || !ts.toDate) return '';
    const d = ts.toDate();
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== МОДАЛЬНОЕ ОКНО =====

function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-title').value = task.title;
    document.getElementById('edit-desc').value = task.description || '';
    document.getElementById('edit-priority').value = task.priority;

    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====

document.addEventListener('DOMContentLoaded', () => {
    // Форма входа
    document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        login(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        );
    });

    // Форма регистрации
    document.getElementById('register-form').addEventListener('submit', e => {
        e.preventDefault();
        register(
            document.getElementById('reg-email').value,
            document.getElementById('reg-password').value
        );
    });

    // Выход
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Форма добавления задачи
    document.getElementById('task-form').addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('task-title').value;
        const desc = document.getElementById('task-desc').value;
        const priority = document.getElementById('task-priority').value;

        addTask(title, desc, priority);
        e.target.reset();
        document.getElementById('task-priority').value = 'medium';
    });

    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTasks();
        });
    });

    // Модальное окно
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('edit-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('edit-modal')) closeModal();
    });

    document.getElementById('edit-form').addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        updateTask(id, {
            title: document.getElementById('edit-title').value.trim(),
            description: document.getElementById('edit-desc').value.trim(),
            priority: document.getElementById('edit-priority').value
        });
        closeModal();
    });
});

// ===== СЛЕЖЕНИЕ ЗА СОСТОЯНИЕМ АВТОРИЗАЦИИ =====

auth.onAuthStateChanged(user => {
    currentUser = user;

    if (user) {
        // Пользователь вошел
        authSection.classList.add('hidden');
        mainSection.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        userEmail.textContent = user.email;
        showAuthMessage('');
        loadTasks();
    } else {
        // Пользователь вышел
        authSection.classList.remove('hidden');
        mainSection.classList.add('hidden');
        userInfo.classList.add('hidden');
        tasks = [];
        tasksContainer.innerHTML = '';
    }
});
