/**
 * Expense Model
 * ---------------------------------------------------------
 * Mirrors the role of internal/model/bookmark.go in the
 * original bookmark-manager project: defines the shape of
 * an Expense record, the allowed value sets, and the request
 * DTOs used by the service/handler layers.
 */

// Allowed categories (equivalent to URL scheme whitelist in the
// bookmark project's validation: http/https only).
const ALLOWED_CATEGORIES = [
  'Makanan',
  'Transportasi',
  'Belanja',
  'Hiburan',
  'Kesehatan',
  'Pendidikan',
  'Tagihan',
  'Lainnya',
];

const ALLOWED_PAYMENT_METHODS = ['Cash', 'Debit', 'Credit', 'E-Wallet'];

const LIMITS = {
  TITLE_MAX_LEN: 200,
  DESCRIPTION_MAX_LEN: 1000,
  TAGS_MAX_COUNT: 10,
  TAG_MAX_LEN: 50,
  AMOUNT_MAX: 999999999.99,
};

/**
 * @typedef {Object} Expense
 * @property {number} id
 * @property {string} title
 * @property {number} amount
 * @property {string} category
 * @property {string} payment_method
 * @property {string} expense_date  - 'YYYY-MM-DD'
 * @property {string|null} description
 * @property {string[]} tags
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CreateExpenseRequest
 * @property {string} title
 * @property {number|string} amount
 * @property {string} category
 * @property {string} [payment_method]
 * @property {string} expense_date
 * @property {string} [description]
 * @property {string[]} [tags]
 */

module.exports = {
  ALLOWED_CATEGORIES,
  ALLOWED_PAYMENT_METHODS,
  LIMITS,
};
