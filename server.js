const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
const db = require('./database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Настройка сессий
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));

// Настройка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    next();
};





// Регистрация
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const result = await db.createUser(username, password, role || 'user');
        res.status(201).json({ message: 'Пользователь создан', userId: result.lastID });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Вход
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.authenticateUser(username, password);
        if (user) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;

            res.json({
                message: 'Вход выполнен успешно',
                user: { id: user.id, username: user.username, role: user.role }
            });
        } else {
            res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Выход выполнен успешно' });
});

// Получение текущего пользователя
app.get('/api/current-user', (req, res) => {
    if (req.session.userId) {
        res.json({
            id: req.session.userId,
            username: req.session.username,
            role: req.session.role
        });
    } else {
        res.status(401).json({ error: 'Не авторизован' });
    }
});



// Получить всех клиентов
app.get('/api/clients', requireAuth, async (req, res) => {
    try {
        const clients = await db.getAllClients();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Получить клиента по ID
app.get('/api/clients/:id', requireAuth, async (req, res) => {
    try {
        const client = await db.getClientById(req.params.id);
        if (client) {
            // Добавляем статистику клиента
            const stats = await db.getClientStats(req.params.id);
            res.json({ ...client, stats });
        } else {
            res.status(404).json({ error: 'Клиент не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Создать нового клиента
app.post('/api/clients', requireAuth, async (req, res) => {
    try {
        const clientData = {
            ...req.body,
            created_by: req.session.userId
        };
        const result = await db.createClient(clientData);
        res.status(201).json({
            message: 'Клиент создан',
            clientId: result.lastID
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Обновить клиента
app.put('/api/clients/:id', requireAuth, async (req, res) => {
    try {
        await db.updateClient(req.params.id, req.body);
        res.json({ message: 'Клиент обновлен' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Удалить клиента
app.delete('/api/clients/:id', requireAuth, async (req, res) => {
    try {
        await db.deleteClient(req.params.id);
        res.json({ message: 'Клиент удален' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Получить историю платежей клиента
app.get('/api/clients/:id/payments', requireAuth, async (req, res) => {
    try {
        const payments = await db.getClientPayments(req.params.id);
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Добавить платеж
app.post('/api/payments', requireAuth, async (req, res) => {
    try {
        const paymentData = {
            ...req.body,
            created_by: req.session.userId
        };
        const result = await db.addPayment(paymentData);
        res.status(201).json({
            message: 'Платеж добавлен',
            paymentId: result.lastID
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});



// Получить историю посещений клиента
app.get('/api/clients/:id/visits', requireAuth, async (req, res) => {
    try {
        const visits = await db.getClientVisits(req.params.id);
        res.json(visits);
    } catch (error) {
        console.error('Error getting visits:', error);
        res.status(500).json({ error: error.message });
    }
});

// Добавить посещение
app.post('/api/visits', requireAuth, async (req, res) => {
    try {
        const visitData = {
            client_id: req.body.client_id,
            created_by: req.session.userId
        };
        const result = await db.addVisit(visitData);
        res.status(201).json({
            message: 'Посещение отмечено',
            visitId: result.lastID
        });
    } catch (error) {
        console.error('Error adding visit:', error);
        res.status(400).json({ error: error.message });
    }
});



// Получить статистику
app.get('/api/statistics', requireAuth, async (req, res) => {
    try {
        const stats = await db.getStatistics();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Поиск клиентов
app.get('/api/search/:query', requireAuth, async (req, res) => {
    try {
        const clients = await db.searchClients(req.params.query);
        res.json(clients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Получить напоминания об истекающих абонементах
app.get('/api/reminders', requireAuth, async (req, res) => {
    try {
        const reminders = await db.getExpiringMemberships();
        res.json(reminders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
});