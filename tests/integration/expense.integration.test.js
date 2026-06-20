/**
 * INTEGRATION TESTS
 * ---------------------------------------------------------
 * Mirrors tests/integration/integration_test.go: drives the
 * full create -> read -> update -> delete -> verify flow
 * through the real stack.
 *
 * UNLIKE the other suites, this one talks to a REAL MySQL
 * database (the repository under test is ExpenseRepository,
 * not the in-memory double) — that's the whole point of an
 * "integration" test: prove the service + repository + MySQL
 * driver actually work together.
 *
 * If no MySQL test database is reachable (e.g. running in a
 * sandbox/CI without MySQL installed), the suite logs a warning
 * and each test short-circuits instead of failing the whole run.
 * To actually exercise this suite:
 *   1. Create a MySQL database (see schema.sql), e.g. expense_tracker_test
 *   2. Set TEST_DB_* values in your .env (see .env.example)
 *   3. npm run test:integration
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const createApp = require('../../src/app');
const ExpenseRepository = require('../../src/repository/expense.repository');

let pool;
let app;
let dbAvailable = false;

const validExpense = {
  title: 'Tiket konser',
  amount: 350000,
  category: 'Hiburan',
  payment_method: 'Credit',
  expense_date: '2026-06-15',
  description: 'Konser musik',
  tags: ['hiburan', 'weekend'],
};

beforeAll(async () => {
  pool = mysql.createPool({
    host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT) || 3306,
    user: process.env.TEST_DB_USER || process.env.DB_USER || 'root',
    password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.TEST_DB_NAME || 'expense_tracker_test',
    decimalNumbers: true,
  });

  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
        expense_date DATE NOT NULL,
        description VARCHAR(1000) NULL,
        tags JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE = InnoDB
    `);
    conn.release();
    dbAvailable = true;
  } catch (err) {
    console.warn(
      '\n[tests/integration] MySQL test database not reachable - skipping integration tests.\n' +
        `Reason: ${err.message}\n` +
        'Set up TEST_DB_* in .env and a real MySQL server to run this suite.\n'
    );
    dbAvailable = false;
  }

  const repo = new ExpenseRepository(pool);
  app = createApp(repo);
});

beforeEach(async () => {
  if (!dbAvailable) return;
  await pool.query('DELETE FROM expenses');
  await pool.query('ALTER TABLE expenses AUTO_INCREMENT = 1');
});

afterAll(async () => {
  if (pool) await pool.end();
});

const request = require('supertest');

describe('Integration: full CRUD flow against real MySQL', () => {
  test('create -> read -> update -> delete -> verify gone', async () => {
    if (!dbAvailable) return;

    const created = await request(app)
      .post('/api/expenses')
      .send(validExpense);
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const fetched = await request(app).get(`/api/expenses/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.title).toBe(validExpense.title);
    expect(fetched.body.data.amount).toBe(validExpense.amount);
    expect(fetched.body.data.tags).toEqual(validExpense.tags);

    const updated = await request(app)
      .put(`/api/expenses/${id}`)
      .send({ ...validExpense, title: 'Tiket konser (upgrade VIP)', amount: 500000 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Tiket konser (upgrade VIP)');
    expect(updated.body.data.amount).toBe(500000);

    const deleted = await request(app).delete(`/api/expenses/${id}`);
    expect(deleted.status).toBe(200);

    const verify = await request(app).get(`/api/expenses/${id}`);
    expect(verify.status).toBe(404);
  });

  test('data persists correctly across multiple inserts and a filtered read', async () => {
    if (!dbAvailable) return;

    await request(app).post('/api/expenses').send({ ...validExpense, category: 'Hiburan' });
    await request(app).post('/api/expenses').send({ ...validExpense, category: 'Makanan' });
    await request(app).post('/api/expenses').send({ ...validExpense, category: 'Hiburan' });

    const res = await request(app).get('/api/expenses?category=Hiburan');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  test('summary aggregation reflects rows actually stored in MySQL', async () => {
    if (!dbAvailable) return;

    await request(app).post('/api/expenses').send({ ...validExpense, amount: 10000 });
    await request(app).post('/api/expenses').send({ ...validExpense, amount: 15000 });

    const res = await request(app).get('/api/expenses/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(25000);
    expect(res.body.data.count).toBe(2);
  });

  test('tags survive a round trip through the JSON column', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/expenses')
      .send({ ...validExpense, tags: ['a', 'b', 'c'] });
    expect(res.body.data.tags).toEqual(['a', 'b', 'c']);

    const fetched = await request(app).get(`/api/expenses/${res.body.data.id}`);
    expect(fetched.body.data.tags).toEqual(['a', 'b', 'c']);
  });
});
