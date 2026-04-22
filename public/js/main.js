// Состояние приложения
let currentUser = null;

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    // Форма входа
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                currentUser = data.user;
                showMainContent();
                loadData();
                showNotification('Вход выполнен успешно', 'success');
            } else {
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Ошибка соединения с сервером', 'error');
        }
    });

    // Форма регистрации
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (password !== confirmPassword) {
            showNotification('Пароли не совпадают', 'error');
            return;
        }

        const username = document.getElementById('registerUsername').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                showNotification('Регистрация успешна. Теперь вы можете войти.', 'success');
                showLogin();
            } else {
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Ошибка соединения с сервером', 'error');
        }
    });

    // Форма добавления клиента
    document.getElementById('clientForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const clientData = {
            full_name: document.getElementById('fullName').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            birth_date: document.getElementById('birthDate').value,
            address: document.getElementById('address').value,
            membership_type: document.getElementById('membershipType').value,
            start_date: document.getElementById('startDate').value,
            price: parseFloat(document.getElementById('price').value),
            notes: document.getElementById('notes').value
        };

        try {
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientData)
            });

            const data = await response.json();

            if (response.ok) {
                showNotification('Клиент добавлен', 'success');
                e.target.reset();
                loadData();
            } else {
                showNotification(data.error, 'error');
            }
        } catch (error) {
            showNotification('Ошибка соединения с сервером', 'error');
        }
    });

    // Поиск при вводе
    document.getElementById('searchInput').addEventListener('input', searchClients);
}

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/current-user');
        const data = await response.json();

        if (response.ok) {
            currentUser = data;
            showMainContent();
            loadData();
        } else {
            showAuthForms();
        }
    } catch (error) {
        showAuthForms();
    }
}

// Показать формы авторизации
function showAuthForms() {
    document.getElementById('authForms').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('authStatus').innerHTML = '';
}

// Показать основной контент
function showMainContent() {
    document.getElementById('authForms').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';

    document.getElementById('authStatus').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Пользователь: <strong>${currentUser.username}</strong> (${currentUser.role})</span>
            <button class="btn btn-danger" onclick="logout()" style="padding: 5px 15px;">Выйти</button>
        </div>
    `;
}

// Показать форму входа
function showLogin() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
}

// Показать форму регистрации
function showRegister() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('registerForm').classList.add('active');
}

// Выход
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showAuthForms();
        showNotification('Вы вышли из системы', 'info');
    } catch (error) {
        showNotification('Ошибка при выходе', 'error');
    }
}

// Загрузка всех данных
async function loadData() {
    await loadStatistics();
    await loadClients();
    await loadReminders();
}

// Загрузка статистики
async function loadStatistics() {
    try {
        const response = await fetch('/api/statistics');
        const stats = await response.json();

        const statsHtml = `
            <div class="stat-card">
                <h3>Всего клиентов</h3>
                <div class="stat-number">${stats.clients.total_clients || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Активных</h3>
                <div class="stat-number">${stats.clients.active_clients || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Посещений сегодня</h3>
                <div class="stat-number">${stats.visits_today || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Доход за месяц</h3>
                <div class="stat-number">${(stats.monthly_income || 0).toLocaleString()} ₽</div>
            </div>
        `;

        document.getElementById('statistics').innerHTML = statsHtml;
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка списка клиентов
async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        const clients = await response.json();

        const tbody = document.getElementById('clientsTableBody');

        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет клиентов</td></tr>';
            return;
        }

        tbody.innerHTML = clients.map(client => {
            const membershipTypes = {
                'monthly': 'Месячный',
                'quarterly': 'Квартальный',
                'yearly': 'Годовой'
            };

            const statusClass = client.status === 'active' ? 'status-active' : 'status-inactive';
            const statusText = client.status === 'active' ? 'Активен' : 'Неактивен';

            return `
                <tr>
                    <td>${client.full_name}</td>
                    <td>${client.phone}</td>
                    <td>${client.email || '—'}</td>
                    <td>${membershipTypes[client.membership_type] || client.membership_type}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${client.visits_count || 0}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-success" onclick="viewClient(${client.id})" style="padding: 5px 10px;">👁️</button>
                            <button class="btn btn-primary" onclick="editClient(${client.id})" style="padding: 5px 10px;">✏️</button>
                            <button class="btn btn-danger" onclick="deleteClient(${client.id})" style="padding: 5px 10px;">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка загрузки клиентов:', error);
        showNotification('Ошибка загрузки клиентов', 'error');
    }
}

// Загрузка напоминаний
async function loadReminders() {
    try {
        const response = await fetch('/api/reminders');
        const reminders = await response.json();

        const card = document.getElementById('remindersCard');
        const list = document.getElementById('remindersList');

        if (reminders.length > 0) {
            card.style.display = 'block';
            list.innerHTML = reminders.map(r => `
                <div class="reminder-item">
                    <h4>${r.full_name}</h4>
                    <p>📞 ${r.phone}</p>
                    <p>⏰ Абонемент истекает: ${new Date(r.end_date).toLocaleDateString()}</p>
                </div>
            `).join('');
        } else {
            card.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка загрузки напоминаний:', error);
    }
}

// Поиск клиентов
async function searchClients() {
    const query = document.getElementById('searchInput').value;

    if (!query) {
        loadClients();
        return;
    }

    try {
        const response = await fetch(`/api/search/${encodeURIComponent(query)}`);
        const clients = await response.json();

        const tbody = document.getElementById('clientsTableBody');

        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Ничего не найдено</td></tr>';
            return;
        }

        tbody.innerHTML = clients.map(client => {
            const membershipTypes = {
                'monthly': 'Месячный',
                'quarterly': 'Квартальный',
                'yearly': 'Годовой'
            };

            return `
                <tr>
                    <td>${client.full_name}</td>
                    <td>${client.phone}</td>
                    <td>${client.email || '—'}</td>
                    <td>${membershipTypes[client.membership_type] || client.membership_type}</td>
                    <td><span class="${client.status === 'active' ? 'status-active' : 'status-inactive'}">${client.status === 'active' ? 'Активен' : 'Неактивен'}</span></td>
                    <td>${client.visits_count || 0}</td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-success" onclick="viewClient(${client.id})" style="padding: 5px 10px;">👁️</button>
                            <button class="btn btn-primary" onclick="editClient(${client.id})" style="padding: 5px 10px;">✏️</button>
                            <button class="btn btn-danger" onclick="deleteClient(${client.id})" style="padding: 5px 10px;">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

// Просмотр деталей клиента
async function viewClient(id) {
    console.log('viewClient called with id:', id);  // ДОБАВЬТЕ ЭТУ СТРОКУ
    try {
        console.log('Fetching client...');
        const response = await fetch(`/api/clients/${id}`);
        console.log('Client response status:', response.status);
        const client = await response.json();
        console.log('Client data:', client);

        console.log('Fetching payments...');
        const paymentsResponse = await fetch(`/api/clients/${id}/payments`);
        const payments = await paymentsResponse.json();
        console.log('Payments:', payments);

        console.log('Fetching visits...')
        const visitsResponse = await fetch(`/api/clients/${id}/visits`);
        const visits = await visitsResponse.json();
        console.log('Visits:', visits);

        const modal = document.getElementById('clientModal');
        const details = document.getElementById('clientDetails');

        const membershipTypes = {
            'monthly': 'Месячный',
            'quarterly': 'Квартальный',
            'yearly': 'Годовой'
        };

        details.innerHTML = `
            <h2>${client.full_name}</h2>
            
            <div style="margin: 20px 0;">
                <h3>Контактная информация</h3>
                <p><strong>Телефон:</strong> ${client.phone}</p>
                <p><strong>Email:</strong> ${client.email || '—'}</p>
                <p><strong>Адрес:</strong> ${client.address || '—'}</p>
                <p><strong>Дата рождения:</strong> ${client.birth_date ? new Date(client.birth_date).toLocaleDateString() : '—'}</p>
            </div>
            
            <div style="margin: 20px 0;">
                <h3>Абонемент</h3>
                <p><strong>Тип:</strong> ${membershipTypes[client.membership_type] || client.membership_type}</p>
                <p><strong>Дата начала:</strong> ${client.start_date ? new Date(client.start_date).toLocaleDateString() : '—'}</p>
                <p><strong>Статус:</strong> <span class="${client.status === 'active' ? 'status-active' : 'status-inactive'}">${client.status === 'active' ? 'Активен' : 'Неактивен'}</span></p>
                <p><strong>Примечания:</strong> ${client.notes || '—'}</p>
            </div>
            
            <div style="margin: 20px 0;">
                <h3>Последние платежи</h3>
                ${payments.length > 0 ? `
                    <table style="width: 100%;">
                        <tr>
                            <th>Дата</th>
                            <th>Сумма</th>
                            <th>Метод</th>
                        </tr>
                        ${payments.slice(0, 5).map(p => `
                            <tr>
                                <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                                <td>${p.amount} ₽</td>
                                <td>${p.payment_method}</td>
                            </tr>
                        `).join('')}
                    </table>
                ` : '<p>Нет платежей</p>'}
            </div>
            
            <div style="margin: 20px 0;">
                <h3>Последние посещения</h3>
                ${visits.length > 0 ? `
                    <ul>
                        ${visits.slice(0, 5).map(v => `
                            <li>${new Date(v.visit_date).toLocaleDateString()} в ${v.check_in_time}</li>
                        `).join('')}
                    </ul>
                ` : '<p>Нет посещений</p>'}
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-primary" onclick="addPayment(${client.id})">Добавить платеж</button>
                <button class="btn btn-success" onclick="addVisit(${client.id})">Отметить посещение</button>
            </div>
        `;

        modal.style.display = 'flex';
    } catch (error) {
        console.error('Error in viewClient:', error);
        console.error('Ошибка загрузки деталей клиента:', error);
        showNotification('Ошибка загрузки деталей', 'error');
    }
}

// Добавление платежа
async function addPayment(clientId) {
    const amount = prompt('Введите сумму платежа:');
    if (!amount) return;

    try {
        const response = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                amount: parseFloat(amount),
                payment_method: 'cash'
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Платеж добавлен', 'success');
            viewClient(clientId);
            loadStatistics();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка добавления платежа', 'error');
    }
}

// Добавление посещения
async function addVisit(clientId) {
    try {
        const response = await fetch('/api/visits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Посещение отмечено', 'success');
            viewClient(clientId);
            loadStatistics();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка отметки посещения', 'error');
    }
}

// Редактирование клиента
async function editClient(id) {
    try {
        const response = await fetch(`/api/clients/${id}`);
        const client = await response.json();

        // Заполняем форму
        document.getElementById('fullName').value = client.full_name;
        document.getElementById('phone').value = client.phone;
        document.getElementById('email').value = client.email || '';
        document.getElementById('birthDate').value = client.birth_date || '';
        document.getElementById('address').value = client.address || '';
        document.getElementById('membershipType').value = client.membership_type;
        document.getElementById('startDate').value = client.start_date || '';
        document.getElementById('price').value = client.price || '';
        document.getElementById('notes').value = client.notes || '';

        // Изменяем обработчик формы
        const form = document.getElementById('clientForm');
        const originalSubmit = form.onsubmit;

        form.onsubmit = async (e) => {
            e.preventDefault();

            const updatedData = {
                full_name: document.getElementById('fullName').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                birth_date: document.getElementById('birthDate').value,
                address: document.getElementById('address').value,
                membership_type: document.getElementById('membershipType').value,
                status: client.status,
                notes: document.getElementById('notes').value
            };

            try {
                const response = await fetch(`/api/clients/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                const data = await response.json();

                if (response.ok) {
                    showNotification('Клиент обновлен', 'success');
                    form.reset();
                    form.onsubmit = originalSubmit;
                    loadClients();
                } else {
                    showNotification(data.error, 'error');
                }
            } catch (error) {
                showNotification('Ошибка обновления', 'error');
            }
        };

        // Прокручиваем к форме
        form.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Ошибка загрузки клиента для редактирования:', error);
    }
}

// Удаление клиента
async function deleteClient(id) {
    if (!confirm('Вы уверены, что хотите удалить этого клиента?')) return;

    try {
        const response = await fetch(`/api/clients/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Клиент удален', 'success');
            loadClients();
            loadStatistics();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Ошибка удаления', 'error');
    }
}

// Закрыть модальное окно
function closeClientModal() {
    document.getElementById('clientModal').style.display = 'none';
}

// Показать уведомление
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Добавляем стили для анимаций
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
