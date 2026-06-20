const { ValidationError } = require('../errors');
const {
  ALLOWED_CATEGORIES,
  ALLOWED_PAYMENT_METHODS,
  LIMITS,
} = require('../models/expense.model');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}

/**
 * Validate + normalize a create/update payload.
 * Throws ValidationError with a clear message on the first
 * violation found, mirroring the layered checks in
 * service/bookmark_service.go (validateCreateRequest).
 */
function validateAndNormalize(input = {}) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description =
    typeof input.description === 'string' ? input.description.trim() : '';
  const category =
    typeof input.category === 'string' ? input.category.trim() : '';
  const paymentMethod =
    typeof input.payment_method === 'string' && input.payment_method.trim()
      ? input.payment_method.trim()
      : 'Cash';
  const expenseDate =
    typeof input.expense_date === 'string' ? input.expense_date.trim() : '';
  const tags = Array.isArray(input.tags) ? input.tags : [];

  if (!title) {
    throw new ValidationError('title is required');
  }
  if (title.length > LIMITS.TITLE_MAX_LEN) {
    throw new ValidationError(
      `title must not exceed ${LIMITS.TITLE_MAX_LEN} characters`
    );
  }

  if (input.amount === undefined || input.amount === null || input.amount === '') {
    throw new ValidationError('amount is required');
  }
  const amount = Number(input.amount);
  if (Number.isNaN(amount) || !Number.isFinite(amount)) {
    throw new ValidationError('amount must be a valid number');
  }
  if (amount <= 0) {
    throw new ValidationError('amount must be greater than zero');
  }
  if (amount > LIMITS.AMOUNT_MAX) {
    throw new ValidationError('amount exceeds the maximum allowed value');
  }

  if (!category) {
    throw new ValidationError('category is required');
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new ValidationError(
      `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
    );
  }

  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new ValidationError(
      `payment_method must be one of: ${ALLOWED_PAYMENT_METHODS.join(', ')}`
    );
  }

  if (!expenseDate) {
    throw new ValidationError('expense_date is required');
  }
  if (!isValidDateString(expenseDate)) {
    throw new ValidationError('expense_date must be a valid date (YYYY-MM-DD)');
  }

  if (description.length > LIMITS.DESCRIPTION_MAX_LEN) {
    throw new ValidationError(
      `description must not exceed ${LIMITS.DESCRIPTION_MAX_LEN} characters`
    );
  }

  if (tags.length > LIMITS.TAGS_MAX_COUNT) {
    throw new ValidationError(
      `maximum ${LIMITS.TAGS_MAX_COUNT} tags allowed`
    );
  }
  for (const t of tags) {
    if (typeof t !== 'string' || t.length > LIMITS.TAG_MAX_LEN) {
      throw new ValidationError(
        `each tag must be a string of at most ${LIMITS.TAG_MAX_LEN} characters`
      );
    }
  }

  return {
    title,
    amount,
    category,
    payment_method: paymentMethod,
    expense_date: expenseDate,
    description: description || null,
    tags,
  };
}

class ExpenseService {
  /**
   * @param {*} repo - any object implementing the repository interface
   *                   (ExpenseRepository or InMemoryExpenseRepository)
   */
  constructor(repo) {
    this.repo = repo;
  }

  async create(input) {
    const data = validateAndNormalize(input);
    return this.repo.create(data);
  }

  async getAll(filters) {
    return this.repo.getAll(filters);
  }

  async getById(id) {
    return this.repo.getById(id);
  }

  async update(id, input) {
    const data = validateAndNormalize(input);
    return this.repo.update(id, data);
  }

  async delete(id) {
    return this.repo.delete(id);
  }

  async count() {
    return this.repo.count();
  }

  async getSummary() {
    return this.repo.getSummary();
  }
}

module.exports = { ExpenseService, validateAndNormalize, isValidDateString };
