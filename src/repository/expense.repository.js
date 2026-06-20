const { NotFoundError } = require('../errors');

class ExpenseRepository {
  /**
   * @param {import('mysql2/promise').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  _rowToExpense(row) {
    let tags = row.tags;
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }
    return {
      id: row.id,
      title: row.title,
      amount: Number(row.amount),
      category: row.category,
      payment_method: row.payment_method,
      expense_date:
        row.expense_date instanceof Date
          ? row.expense_date.toISOString().slice(0, 10)
          : row.expense_date,
      description: row.description,
      tags: tags || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async create(data) {
    const [result] = await this.pool.execute(
      `INSERT INTO expenses
        (title, amount, category, payment_method, expense_date, description, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.amount,
        data.category,
        data.payment_method,
        data.expense_date,
        data.description || null,
        JSON.stringify(data.tags || []),
      ]
    );
    return this.getById(result.insertId);
  }

  async getAll({ category, tag } = {}) {
    let sql = 'SELECT * FROM expenses';
    const params = [];
    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    sql += ' ORDER BY expense_date DESC, id DESC';

    const [rows] = await this.pool.execute(sql, params);
    let expenses = rows.map((r) => this._rowToExpense(r));

    if (tag) {
      expenses = expenses.filter((e) => e.tags.includes(tag));
    }
    return expenses;
  }

  async getById(id) {
    const [rows] = await this.pool.execute(
      'SELECT * FROM expenses WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      throw new NotFoundError();
    }
    return this._rowToExpense(rows[0]);
  }

  async update(id, data) {
    // Will throw NotFoundError if it doesn't exist
    await this.getById(id);

    await this.pool.execute(
      `UPDATE expenses SET
        title = ?, amount = ?, category = ?, payment_method = ?,
        expense_date = ?, description = ?, tags = ?
       WHERE id = ?`,
      [
        data.title,
        data.amount,
        data.category,
        data.payment_method,
        data.expense_date,
        data.description || null,
        JSON.stringify(data.tags || []),
        id,
      ]
    );
    return this.getById(id);
  }

  async delete(id) {
    const [result] = await this.pool.execute(
      'DELETE FROM expenses WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError();
    }
  }

  async count() {
    const [rows] = await this.pool.execute(
      'SELECT COUNT(*) AS total FROM expenses'
    );
    return rows[0].total;
  }

  async getSummary() {
    const [totalRows] = await this.pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses'
    );
    const [byCategoryRows] = await this.pool.execute(
      `SELECT category, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM expenses GROUP BY category ORDER BY total DESC`
    );
    return {
      total: Number(totalRows[0].total),
      count: totalRows[0].count,
      byCategory: byCategoryRows.map((r) => ({
        category: r.category,
        total: Number(r.total),
        count: r.count,
      })),
    };
  }
}

module.exports = ExpenseRepository;
