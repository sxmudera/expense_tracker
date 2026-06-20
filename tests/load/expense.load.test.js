/**
 * LOAD & STRESS TESTS
 * ---------------------------------------------------------
 * Lighter-weight version of tests/load/load_stress_test.go:
 * enough to catch obvious performance regressions and race
 * conditions, without needing the same request counts as the
 * original Go suite. Runs against the in-memory repository so
 * timings reflect the app/service layer, not network/DB latency.
 */
const request = require('supertest');
const createApp = require('../../src/app');
const InMemoryExpenseRepository = require('../../src/repository/expense.repository.memory');

function setupApp() {
  return createApp(new InMemoryExpenseRepository());
}

function expensePayload(i) {
  return {
    title: `Load expense ${i}`,
    amount: 1000 + i,
    category: 'Lainnya',
    expense_date: '2026-06-01',
  };
}

describe('Load: sequential requests', () => {
  test('handles 200 sequential GETs comfortably under 2s', async () => {
    const app = setupApp();
    await request(app).post('/api/expenses').send(expensePayload(0));

    const start = Date.now();
    let successCount = 0;
    const total = 200;

    for (let i = 0; i < total; i++) {
      const res = await request(app).get('/api/expenses');
      if (res.status === 200) successCount++;
    }

    const elapsedMs = Date.now() - start;
    console.log(`LOAD-01: ${total} GET in ${elapsedMs}ms`);

    expect(successCount).toBe(total);
    expect(elapsedMs).toBeLessThan(2000);
  });

  test('handles 100 sequential POSTs and all are persisted', async () => {
    const app = setupApp();
    const total = 100;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const res = await request(app).post('/api/expenses').send(expensePayload(i));
      if (res.status === 201) successCount++;
    }

    expect(successCount).toBe(total);

    const list = await request(app).get('/api/expenses');
    expect(list.body.data).toHaveLength(total);
  });
});

describe('Load: concurrent requests', () => {
  test('50 concurrent GETs all succeed with no errors', async () => {
    const app = setupApp();
    await request(app).post('/api/expenses').send(expensePayload(0));

    const concurrency = 50;
    const start = Date.now();
    const results = await Promise.all(
      Array.from({ length: concurrency }, () => request(app).get('/api/expenses'))
    );
    const elapsedMs = Date.now() - start;

    const successCount = results.filter((r) => r.status === 200).length;
    console.log(`LOAD-02: ${concurrency} concurrent GET in ${elapsedMs}ms`);

    expect(successCount).toBe(concurrency);
  });

  test('mixed concurrent reads and writes do not corrupt data (no lost updates)', async () => {
    const app = setupApp();
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/expenses').send(expensePayload(i));
    }

    const writers = Array.from({ length: 20 }, (_, i) =>
      request(app).post('/api/expenses').send(expensePayload(100 + i))
    );
    const readers = Array.from({ length: 30 }, () => request(app).get('/api/expenses'));

    const results = await Promise.all([...writers, ...readers]);
    const errorCount = results.filter((r) => r.status >= 500).length;

    expect(errorCount).toBe(0);

    const finalList = await request(app).get('/api/expenses');
    expect(finalList.body.data).toHaveLength(5 + 20);
  });
});

describe('Stress: burst creation', () => {
  test('creates 500 expenses back-to-back without failure', async () => {
    const app = setupApp();
    const total = 500;
    const start = Date.now();
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const res = await request(app).post('/api/expenses').send(expensePayload(i));
      if (res.status === 201) successCount++;
    }

    const elapsedMs = Date.now() - start;
    console.log(`STRESS-01: created ${successCount}/${total} in ${elapsedMs}ms`);

    expect(successCount).toBe(total);

    const list = await request(app).get('/api/expenses');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(total);
  }, 20000);

  test('rapid create+delete cycles leave the store empty and consistent', async () => {
    const app = setupApp();
    const cycles = 50;
    let createdOk = 0;
    let deletedOk = 0;

    for (let i = 0; i < cycles; i++) {
      const created = await request(app).post('/api/expenses').send(expensePayload(i));
      if (created.status === 201) {
        createdOk++;
        const del = await request(app).delete(`/api/expenses/${created.body.data.id}`);
        if (del.status === 200) deletedOk++;
      }
    }

    expect(createdOk).toBe(cycles);
    expect(deletedOk).toBe(cycles);

    const list = await request(app).get('/api/expenses');
    expect(list.body.data).toHaveLength(0);
  }, 15000);
});
