/**
 * SECURITY TESTS
 * ---------------------------------------------------------
 * Mirrors the intent of tests/security/security_test.go: throw
 * malicious / malformed input at the API and make sure it never
 * crashes (no 500s) and rejects what it should reject. Category
 * whitelist validation plays the same role here that URL-scheme
 * validation played in the bookmark project.
 */
const request = require('supertest');
const createApp = require('../../src/app');
const InMemoryExpenseRepository = require('../../src/repository/expense.repository.memory');

function setupApp() {
  return createApp(new InMemoryExpenseRepository());
}

const base = {
  amount: 10000,
  category: 'Makanan',
  expense_date: '2026-06-01',
};

describe('Security: injection & script payloads', () => {
  test('SEC-01: XSS payload in title does not crash the server', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: '<script>alert("xss")</script>' });
    expect(res.status).not.toBe(500);
  });

  test('SEC-02: XSS payload in description does not crash the server', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: 'XSS desc', description: '<img src=x onerror=alert(1)>' });
    expect(res.status).not.toBe(500);
  });

  test('SEC-03: SQL injection string in title is stored as plain text, not executed', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: "'; DROP TABLE expenses; --" });
    expect(res.status).not.toBe(500);
    expect(res.body.data.title).toBe("'; DROP TABLE expenses; --");
  });

  test('SEC-04: SQL injection in category is rejected by the whitelist (400)', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: 'X', category: "Makanan' OR '1'='1" });
    expect(res.status).toBe(400);
  });
});

describe('Security: malformed / oversized input', () => {
  test('SEC-05: empty JSON object does not crash the server', async () => {
    const app = setupApp();
    const res = await request(app).post('/api/expenses').send({});
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(400);
  });

  test('SEC-06: oversized description (>1MB body) is rejected, not accepted', async () => {
    const app = setupApp();
    const bigDescription = 'A'.repeat(2 * 1024 * 1024); // 2MB
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: 'Big', description: bigDescription });
    expect(res.status).not.toBe(201);
  });

  test('SEC-07: null byte in title does not crash the server', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: 'Hello\x00World' });
    expect(res.status).not.toBe(500);
  });

  test('SEC-08: unicode/emoji in title is accepted normally', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: '🍜 Mie ayam ‎— enak banget' });
    expect(res.status).toBe(201);
  });

  test('SEC-09: special characters in tags do not crash the server', async () => {
    const app = setupApp();
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...base, title: 'Tag test', tags: ['<script>', "'; DROP", '../etc'] });
    expect(res.status).not.toBe(500);
  });
});

describe('Security: id parameter handling', () => {
  test('SEC-10: negative id does not crash the server', async () => {
    const app = setupApp();
    const res = await request(app).get('/api/expenses/-1');
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(400);
  });

  test('SEC-11: absurdly large id (integer overflow attempt) returns 400, not a crash', async () => {
    const app = setupApp();
    const res = await request(app).get('/api/expenses/99999999999999999999999');
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(400);
  });

  test('SEC-12: path traversal attempt in id segment does not crash and is not 200', async () => {
    const app = setupApp();
    const res = await request(app).get('/api/expenses/../../etc/passwd');
    expect(res.status).not.toBe(500);
    expect(res.status).not.toBe(200);
  });
});

describe('Security: CORS', () => {
  test('SEC-13: preflight OPTIONS request does not crash the server', async () => {
    const app = setupApp();
    const res = await request(app)
      .options('/api/expenses')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).not.toBe(500);
  });
});
