const { NotFoundError } = require('../errors');

/**
 * InMemoryExpenseRepository
 * ---------------------------------------------------------
 * A test double that implements the exact same interface as
 * ExpenseRepository (MySQL), but stores data in a Map.
 *
 * Why this exists: in the original Go bookmark-manager project,
 * the "repository" itself was in-memory, so every test (whitebox,
 * blackbox, load, security) could run instantly without any
 * external dependency. Here the production repository is backed
 * by real MySQL, so we keep a same-shaped in-memory double for
 * fast, deterministic tests — only tests/integration talk to a
 * real MySQL database, on purpose.
 */
class InMemoryExpenseRepository {
  constructor() {
    this.expenses = new Map();
    this.nextId = 1;
  }

  _clone(expense) {
    return { ...expense, tags: [...expense.tags] };
  }

  async create(data) {
    const now = new Date().toISOString();
    const expense = {
      id: this.nextId,
      title: data.title,
      amount: Number(data.amount),
      category: data.category,
      payment_method: data.payment_method,
      expense_date: data.expense_date,
      description: data.description || null,
      tags: data.tags || [],
      created_at: now,
      updated_at: now,
    };
    this.expenses.set(this.nextId, expense);
    this.nextId++;
    return this._clone(expense);
  }

  async getAll({ category, tag } = {}) {
    let result = Array.from(this.expenses.values());
    if (category) {
      result = result.filter((e) => e.category === category);
    }
    if (tag) {
      result = result.filter((e) => e.tags.includes(tag));
    }
    // Mirror "ORDER BY expense_date DESC, id DESC"
    result.sort((a, b) => {
      if (a.expense_date !== b.expense_date) {
        return a.expense_date < b.expense_date ? 1 : -1;
      }
      return b.id - a.id;
    });
    return result.map((e) => this._clone(e));
  }

  async getById(id) {
    const expense = this.expenses.get(id);
    if (!expense) {
      throw new NotFoundError();
    }
    return this._clone(expense);
  }

  async update(id, data) {
    const expense = this.expenses.get(id);
    if (!expense) {
      throw new NotFoundError();
    }
    expense.title = data.title;
    expense.amount = Number(data.amount);
    expense.category = data.category;
    expense.payment_method = data.payment_method;
    expense.expense_date = data.expense_date;
    expense.description = data.description || null;
    expense.tags = data.tags || [];
    expense.updated_at = new Date().toISOString();
    return this._clone(expense);
  }

  async delete(id) {
    if (!this.expenses.has(id)) {
      throw new NotFoundError();
    }
    this.expenses.delete(id);
  }

  async count() {
    return this.expenses.size;
  }

  async getSummary() {
    const all = Array.from(this.expenses.values());
    const total = all.reduce((sum, e) => sum + e.amount, 0);
    const byCategoryMap = new Map();
    for (const e of all) {
      const entry = byCategoryMap.get(e.category) || { total: 0, count: 0 };
      entry.total += e.amount;
      entry.count += 1;
      byCategoryMap.set(e.category, entry);
    }
    const byCategory = Array.from(byCategoryMap.entries())
      .map(([category, v]) => ({ category, total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total);

    return { total, count: all.length, byCategory };
  }
}

module.exports = InMemoryExpenseRepository;
