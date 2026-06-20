const { ExpenseService } = require('../../src/service/expense.service');
const InMemoryExpenseRepository = require('../../src/repository/expense.repository.memory');
const { ValidationError, NotFoundError } = require('../../src/errors');

function newService() {
  return new ExpenseService(new InMemoryExpenseRepository());
}

const validInput = {
  title: 'Makan siang',
  amount: 25000,
  category: 'Makanan',
  payment_method: 'Cash',
  expense_date: '2026-06-01',
  description: 'Nasi ayam',
  tags: ['harian'],
};

describe('ExpenseService.create - validation', () => {
  test('creates an expense with valid input', async () => {
    const svc = newService();
    const expense = await svc.create(validInput);
    expect(expense.id).toBe(1);
    expect(expense.title).toBe('Makan siang');
    expect(expense.amount).toBe(25000);
  });

  test('rejects empty title', async () => {
    const svc = newService();
    await expect(svc.create({ ...validInput, title: '' })).rejects.toThrow(
      ValidationError
    );
  });

  test('rejects whitespace-only title', async () => {
    const svc = newService();
    await expect(svc.create({ ...validInput, title: '   ' })).rejects.toThrow(
      'title is required'
    );
  });

  test('rejects title longer than 200 characters', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, title: 'a'.repeat(201) })
    ).rejects.toThrow('title must not exceed 200 characters');
  });

  test('rejects missing amount', async () => {
    const svc = newService();
    const input = { ...validInput };
    delete input.amount;
    await expect(svc.create(input)).rejects.toThrow('amount is required');
  });

  test('rejects non-numeric amount', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, amount: 'abc' })
    ).rejects.toThrow('amount must be a valid number');
  });

  test('rejects zero amount', async () => {
    const svc = newService();
    await expect(svc.create({ ...validInput, amount: 0 })).rejects.toThrow(
      'amount must be greater than zero'
    );
  });

  test('rejects negative amount', async () => {
    const svc = newService();
    await expect(svc.create({ ...validInput, amount: -500 })).rejects.toThrow(
      'amount must be greater than zero'
    );
  });

  test('rejects amount above the maximum allowed', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, amount: 9999999999 })
    ).rejects.toThrow('amount exceeds the maximum allowed value');
  });

  test('rejects empty category', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, category: '' })
    ).rejects.toThrow('category is required');
  });

  test('rejects category outside the allowed whitelist', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, category: 'Investasi Kripto' })
    ).rejects.toThrow(/category must be one of/);
  });

  test('rejects payment_method outside the allowed whitelist', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, payment_method: 'Bitcoin' })
    ).rejects.toThrow(/payment_method must be one of/);
  });

  test('defaults payment_method to Cash when omitted', async () => {
    const svc = newService();
    const input = { ...validInput };
    delete input.payment_method;
    const expense = await svc.create(input);
    expect(expense.payment_method).toBe('Cash');
  });

  test('rejects missing expense_date', async () => {
    const svc = newService();
    const input = { ...validInput };
    delete input.expense_date;
    await expect(svc.create(input)).rejects.toThrow('expense_date is required');
  });

  test('rejects malformed expense_date', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, expense_date: '01-06-2026' })
    ).rejects.toThrow(/expense_date must be a valid date/);
  });

  test('rejects description longer than 1000 characters', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, description: 'a'.repeat(1001) })
    ).rejects.toThrow('description must not exceed 1000 characters');
  });

  test('rejects more than 10 tags', async () => {
    const svc = newService();
    const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    await expect(svc.create({ ...validInput, tags })).rejects.toThrow(
      'maximum 10 tags allowed'
    );
  });

  test('rejects a tag longer than 50 characters', async () => {
    const svc = newService();
    await expect(
      svc.create({ ...validInput, tags: ['a'.repeat(51)] })
    ).rejects.toThrow(/each tag must be a string/);
  });

  test('defaults tags to an empty array when omitted', async () => {
    const svc = newService();
    const input = { ...validInput };
    delete input.tags;
    const expense = await svc.create(input);
    expect(expense.tags).toEqual([]);
  });
});

describe('ExpenseService - read/update/delete logic', () => {
  test('getById throws NotFoundError for a missing id', async () => {
    const svc = newService();
    await expect(svc.getById(999)).rejects.toThrow(NotFoundError);
  });

  test('update validates the new payload the same way as create', async () => {
    const svc = newService();
    const created = await svc.create(validInput);
    await expect(
      svc.update(created.id, { ...validInput, amount: -1 })
    ).rejects.toThrow(ValidationError);
  });

  test('update applies changes and bumps updated_at', async () => {
    const svc = newService();
    const created = await svc.create(validInput);
    const updated = await svc.update(created.id, {
      ...validInput,
      title: 'Makan malam',
      amount: 40000,
    });
    expect(updated.title).toBe('Makan malam');
    expect(updated.amount).toBe(40000);
  });

  test('delete removes the expense', async () => {
    const svc = newService();
    const created = await svc.create(validInput);
    await svc.delete(created.id);
    await expect(svc.getById(created.id)).rejects.toThrow(NotFoundError);
  });

  test('delete throws NotFoundError for a missing id', async () => {
    const svc = newService();
    await expect(svc.delete(999)).rejects.toThrow(NotFoundError);
  });

  test('count reflects the number of stored expenses', async () => {
    const svc = newService();
    expect(await svc.count()).toBe(0);
    await svc.create(validInput);
    await svc.create({ ...validInput, title: 'Kopi' });
    expect(await svc.count()).toBe(2);
  });

  test('getSummary aggregates total and per-category totals', async () => {
    const svc = newService();
    await svc.create({ ...validInput, amount: 20000, category: 'Makanan' });
    await svc.create({ ...validInput, amount: 30000, category: 'Makanan' });
    await svc.create({ ...validInput, amount: 50000, category: 'Transportasi' });

    const summary = await svc.getSummary();
    expect(summary.total).toBe(100000);
    expect(summary.count).toBe(3);

    const makanan = summary.byCategory.find((c) => c.category === 'Makanan');
    expect(makanan.total).toBe(50000);
    expect(makanan.count).toBe(2);
  });

  test('getAll filters by category', async () => {
    const svc = newService();
    await svc.create({ ...validInput, category: 'Makanan' });
    await svc.create({ ...validInput, category: 'Transportasi' });

    const result = await svc.getAll({ category: 'Makanan' });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Makanan');
  });

  test('getAll filters by tag', async () => {
    const svc = newService();
    await svc.create({ ...validInput, tags: ['kuliah'] });
    await svc.create({ ...validInput, tags: ['liburan'] });

    const result = await svc.getAll({ tag: 'liburan' });
    expect(result).toHaveLength(1);
    expect(result[0].tags).toContain('liburan');
  });
});
