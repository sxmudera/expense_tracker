/**
 * BLACKBOX TESTS
 * ---------------------------------------------------------
 * Exercises the API purely through HTTP, the same way
 * tests/blackbox/blackbox_test.go hit the bookmark API: only
 * status codes and response JSON shape matter here, not the
 * internal implementation. Uses createApp() + InMemoryExpenseRepository
 * so each test gets a clean, isolated, dependency-free server.
 */
const request = require('supertest');
const createApp = require('../../src/app');
const InMemoryExpenseRepository = require('../../src/repository/expense.repository.memory');

function setupApp() {
  return createApp(new InMemoryExpenseRepository());
}

const validExpense = {
  title: 'Belanja bulanan',
  amount: 150000,
  category: 'Belanja',
  payment_method: 'Debit',
  expense_date: '2026-06-10',
  description: 'Supermarket',
  tags: ['bulanan'],
};

describe('Blackbox: POST /api/expenses', () => {
  test('returns 201 and success=true on valid input', async () => {
    const app = setupApp();
    const res = await request(app).post('/api/expenses').send(validExpense);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
  });

  test('returns 400 when title is missing', async () => {
    const app = setupApp();
    const { title, ...rest } = validExpense;
    const res = await request(app).post('/api/expenses').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for an invalid category', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...validExpense, category: 'NotARealCategory' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for malformed JSON body', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBe(400);
  });
});

describe('Blackbox: GET /api/expenses', () => {
  test('returns 200 with an empty array initially', async () => {
    const app = setupApp();
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('content-type is application/json', async () => {
    const app = setupApp();
    const res = await request(app).get('/api/expenses');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('?category= filters results', async () => {
    const app = setupApp();
    await request(app).post('/api/expenses').send(validExpense);
    await request(app)
      .post('/api/expenses')
      .send({ ...validExpense, category: 'Hiburan' });

    const res = await request(app).get('/api/expenses?category=Hiburan');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe('Hiburan');
  });
});

describe('Blackbox: GET /api/expenses/:id', () => {
  test('returns 200 for an existing expense', async () => {
    const app = setupApp();
    await request(app).post('/api/expenses').send(validExpense);
    const res = await request(app).get('/api/expenses/1');
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(validExpense.title);
  });

  test('returns 404 for a non-existent id', async () => {
    const app = setupApp();
    const res = await request(app).get('/api/expenses/999');
    expect(res.status).toBe(404);
  });

  test('returns 400 for a non-numeric id', async () => {
    const app = setupApp();
    const res = await request(app).get('/api/expenses/abc');
    expect(res.status).toBe(400);
  });
});

describe('Blackbox: PUT /api/expenses/:id', () => {
  test('returns 200 and the updated fields', async () => {
    const app = setupApp();
    await request(app).post('/api/expenses').send(validExpense);
    const res = await request(app)
      .put('/api/expenses/1')
      .send({ ...validExpense, title: 'Belanja bulanan (revisi)', amount: 175000 });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Belanja bulanan (revisi)');
    expect(res.body.data.amount).toBe(175000);
  });

  test('returns 404 when updating a non-existent id', async () => {
    const app = setupApp();
    const res = await request(app).put('/api/expenses/999').send(validExpense);
    expect(res.status).toBe(404);
  });
});

describe('Blackbox: DELETE /api/expenses/:id', () => {
  test('returns 200 and the expense is actually gone', async () => {
    const app = setupApp();
    await request(app).post('/api/expenses').send(validExpense);
    const del = await request(app).delete('/api/expenses/1');
    expect(del.status).toBe(200);

    const get = await request(app).get('/api/expenses/1');
    expect(get.status).toBe(404);
  });

  test('returns 404 when deleting a non-existent id', async () => {
    const app = setupApp();
    const res = await request(app).delete('/api/expenses/999');
    expect(res.status).toBe(404);
  });
});

describe('Blackbox: GET /api/expenses/summary', () => {
  test('returns aggregated totals', async () => {
    const app = setupApp();
    await request(app).post('/api/expenses').send({ ...validExpense, amount: 10000 });
    await request(app).post('/api/expenses').send({ ...validExpense, amount: 20000 });

    const res = await request(app).get('/api/expenses/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(30000);
    expect(res.body.data.count).toBe(2);
  });
});

describe('Blackbox: misc', () => {
  test('GET /health returns ok', async () => {
    const app = setupApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('unsupported method on a resource returns 404 (no matching route)', async () => {
    const app = setupApp();
    const res = await request(app).patch('/api/expenses');
    expect(res.status).toBe(404);
  });
});
