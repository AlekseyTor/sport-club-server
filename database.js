const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const moment = require('moment');

const dbPath = path.join(__dirname, 'sportclub.db');
const db = new sqlite3.Database(dbPath);



db.serialize(() => {
    // Таблица пользователей
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Таблица клиентов
    db.run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            birth_date DATE,
            email TEXT,
            address TEXT,
            membership_type TEXT DEFAULT 'monthly',
            start_date DATE DEFAULT CURRENT_DATE,
            price REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    // Таблица платежей
    db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_date DATE DEFAULT CURRENT_DATE,
            payment_method TEXT DEFAULT 'cash',
            description TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    // Таблица абонементов
    db.run(`
        CREATE TABLE IF NOT EXISTS memberships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            price REAL NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        )
    `);

    // Таблица посещений
    db.run(`
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            visit_date DATE DEFAULT CURRENT_DATE,
            check_in_time TIME DEFAULT CURRENT_TIME,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    // Создание индексов для оптимизации
    db.run(`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_memberships_client ON memberships(client_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_client ON visits(client_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date)`);

    // Создание тестового администратора
    const salt = bcrypt.genSaltSync(10);
    const adminPassword = bcrypt.hashSync('admin123', salt);
    
    db.get(`SELECT * FROM users WHERE username = 'admin'`, (err, row) => {
        if (!row) {
            db.run(`
                INSERT INTO users (username, password, role) 
                VALUES (?, ?, ?)
            `, ['admin', adminPassword, 'admin']);
            console.log('Тестовый администратор создан: admin / admin123');
        }
    });
});


// ФУНКЦИИ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ


const database = {
    // Создание пользователя
    createUser: (username, password, role) => {
        return new Promise((resolve, reject) => {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(password, salt);
            
            db.run(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [username, hash, role],
                function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                }
            );
        });
    },

    // Аутентификация пользователя
    authenticateUser: (username, password) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username, password, role FROM users WHERE username = ?',
                [username],
                (err, user) => {
                    if (err) reject(err);
                    else if (user && bcrypt.compareSync(password, user.password)) {
                        const { password, ...userWithoutPassword } = user;
                        resolve(userWithoutPassword);
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    },

   
    // ФУНКЦИИ ДЛЯ РАБОТЫ С КЛИЕНТАМИ
   

    // Получение всех клиентов
    getAllClients: () => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT c.*, u.username as created_by_name,
                       (SELECT COUNT(*) FROM payments WHERE client_id = c.id) as payments_count,
                       (SELECT COUNT(*) FROM visits WHERE client_id = c.id) as visits_count
                FROM clients c
                LEFT JOIN users u ON c.created_by = u.id
                ORDER BY c.created_at DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Получение клиента по ID
    getClientById: (id) => {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT c.*, u.username as created_by_name
                FROM clients c
                LEFT JOIN users u ON c.created_by = u.id
                WHERE c.id = ?
            `, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    // Получение статистики клиента
    getClientStats: (clientId) => {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM visits WHERE client_id = ?) as total_visits,
                    (SELECT COUNT(*) FROM visits 
                     WHERE client_id = ? AND strftime('%Y-%m', visit_date) = strftime('%Y-%m', 'now')) as visits_this_month,
                    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE client_id = ?) as total_paid,
                    (SELECT MAX(visit_date) FROM visits WHERE client_id = ?) as last_visit_date,
                    (SELECT check_in_time FROM visits 
                     WHERE client_id = ? AND visit_date = (SELECT MAX(visit_date) FROM visits WHERE client_id = ?)
                     LIMIT 1) as last_visit_time
            `, [clientId, clientId, clientId, clientId, clientId, clientId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { total_visits: 0, visits_this_month: 0, total_paid: 0 });
            });
        });
    },

    // Создание клиента
    createClient: (clientData) => {
        return new Promise((resolve, reject) => {
            const {
                full_name, phone, email, birth_date, address,
                membership_type, start_date, price, notes, created_by
            } = clientData;

            db.run(`
                INSERT INTO clients (
                    full_name, phone, birth_date, email, address,
                    membership_type, start_date, price, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                full_name, phone, birth_date || null, email || null, address || null,
                membership_type || 'monthly', 
                start_date || new Date().toISOString().split('T')[0],
                price || 0, notes || null, created_by
            ], function(err) {
                if (err) reject(err);
                else {
                    // Создаем запись об абонементе
                    const startDate = new Date(start_date || new Date());
                    const endDate = new Date(startDate);
                    
                    switch(membership_type) {
                        case 'monthly': endDate.setMonth(endDate.getMonth() + 1); break;
                        case 'quarterly': endDate.setMonth(endDate.getMonth() + 3); break;
                        case 'yearly': endDate.setFullYear(endDate.getFullYear() + 1); break;
                        default: endDate.setMonth(endDate.getMonth() + 1);
                    }

                    db.run(`
                        INSERT INTO memberships (
                            client_id, type, start_date, end_date, price, status
                        ) VALUES (?, ?, ?, ?, ?, 'active')
                    `, [this.lastID, membership_type || 'monthly', 
                        start_date || new Date().toISOString().split('T')[0],
                        endDate.toISOString().split('T')[0], price || 0]);
                    
                    resolve({ lastID: this.lastID });
                }
            });
        });
    },

    // Обновление клиента
    updateClient: (id, updateData) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
            
            const allowedFields = ['full_name', 'phone', 'email', 'birth_date', 
                                   'address', 'membership_type', 'status', 'notes'];
            
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    values.push(updateData[field]);
                }
            }
            
            if (fields.length === 0) {
                reject(new Error('Нет данных для обновления'));
                return;
            }
            
            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);
            
            const query = `UPDATE clients SET ${fields.join(', ')} WHERE id = ?`;
            
            db.run(query, values, function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },

    // Удаление клиента
    deleteClient: (id) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },

    
    // ФУНКЦИИ ДЛЯ РАБОТЫ С ПЛАТЕЖАМИ
   

    // Добавление платежа
    addPayment: (paymentData) => {
        return new Promise((resolve, reject) => {
            const { client_id, amount, payment_method, description, created_by } = paymentData;
            
            db.run(`
                INSERT INTO payments (client_id, amount, payment_method, description, created_by)
                VALUES (?, ?, ?, ?, ?)
            `, [client_id, amount, payment_method || 'cash', description || null, created_by], 
            function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            });
        });
    },

    // Получение платежей клиента
    getClientPayments: (clientId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT p.*, u.username as created_by_name
                FROM payments p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.client_id = ?
                ORDER BY p.payment_date DESC, p.created_at DESC
                LIMIT 20
            `, [clientId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

   
    // ФУНКЦИИ ДЛЯ РАБОТЫ С ПОСЕЩЕНИЯМИ 
   

    // Получение истории посещений клиента
    getClientVisits: (clientId, limit = 20) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT v.*, u.username as created_by_name
                FROM visits v
                LEFT JOIN users u ON v.created_by = u.id
                WHERE v.client_id = ?
                ORDER BY v.visit_date DESC, v.check_in_time DESC
                LIMIT ?
            `, [clientId, limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    // Добавление посещения
    addVisit: (visitData) => {
        return new Promise((resolve, reject) => {
            const { client_id, created_by } = visitData;
            
            db.run(`
                INSERT INTO visits (client_id, created_by, visit_date, check_in_time)
                VALUES (?, ?, DATE('now'), TIME('now'))
            `, [client_id, created_by], function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID });
            });
        });
    },

    // Получение количества посещений за сегодня
    getTodayVisitsCount: () => {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as count
                FROM visits
                WHERE visit_date = DATE('now')
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });
    },

    
    // ФУНКЦИИ ДЛЯ РАБОТЫ С АБОНЕМЕНТАМИ
  

    // Получение истекающих абонементов
    getExpiringMemberships: () => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT m.*, c.full_name, c.phone, c.email,
                       julianday(m.end_date) - julianday('now') as days_left
                FROM memberships m
                JOIN clients c ON m.client_id = c.id
                WHERE m.end_date BETWEEN DATE('now') AND DATE('now', '+7 days')
                AND m.status = 'active'
                ORDER BY m.end_date
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

   
    // ФУНКЦИИ ДЛЯ ПОИСКА И СТАТИСТИКИ
 

    // Поиск клиентов
    searchClients: (query) => {
        return new Promise((resolve, reject) => {
            const searchTerm = `%${query}%`;
            db.all(`
                SELECT c.*,
                       (SELECT COUNT(*) FROM visits WHERE client_id = c.id) as visits_count
                FROM clients c
                WHERE c.full_name LIKE ? 
                   OR c.phone LIKE ? 
                   OR c.email LIKE ?
                ORDER BY 
                    CASE 
                        WHEN c.full_name LIKE ? THEN 1
                        WHEN c.phone LIKE ? THEN 2
                        WHEN c.email LIKE ? THEN 3
                        ELSE 4
                    END,
                    c.full_name
                LIMIT 50
            `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm], 
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Получение общей статистики
    getStatistics: () => {
        return new Promise(async (resolve, reject) => {
            try {
                const stats = {};
                
                // Статистика по клиентам
                const clientsStats = await new Promise((resolve, reject) => {
                    db.get(`
                        SELECT 
                            COUNT(*) as total_clients,
                            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_clients,
                            SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_clients
                        FROM clients
                    `, [], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                stats.clients = clientsStats;
                
                // Посещения сегодня
                stats.visits_today = await database.getTodayVisitsCount();
                
                // Доход за месяц
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                
                const income = await new Promise((resolve, reject) => {
                    db.get(`
                        SELECT COALESCE(SUM(amount), 0) as total
                        FROM payments
                        WHERE strftime('%Y-%m', payment_date) = ?
                    `, [`${year}-${month}`], (err, row) => {
                        if (err) reject(err);
                        else resolve(row.total);
                    });
                });
                stats.monthly_income = income;
                
                // Истекающие абонементы
                stats.expiring_soon = await database.getExpiringMemberships();
                
                resolve(stats);
            } catch (error) {
                reject(error);
            }
        });
    }
};

module.exports = database;