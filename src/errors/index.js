/**
 * Custom error types used across the layers.
 * Mirrors the sentinel errors declared in the Go project
 * (repository.ErrNotFound, service.ErrTitleRequired, etc.)
 * so the handler layer can map them to the correct HTTP status.
 */

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message = 'expense not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

module.exports = { ValidationError, NotFoundError };
