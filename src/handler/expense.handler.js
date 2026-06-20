const { ValidationError, NotFoundError } = require('../errors');

function ok(res, status, data, message) {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/** Validates a route :id param. Returns a positive integer or null. */
function parseId(raw) {
  if (!/^\d+$/.test(String(raw))) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function handleError(res, err) {
  if (err instanceof ValidationError) {
    return fail(res, 400, err.message);
  }
  if (err instanceof NotFoundError) {
    return fail(res, 404, err.message);
  }
  console.error('Unexpected error:', err);
  return fail(res, 500, 'internal server error');
}

/**
 * Factory: creates the handler object bound to a given service.
 * Mirrors handler.NewBookmarkHandler(svc) in the Go project.
 */
function createExpenseHandler(service) {
  return {
    async list(req, res) {
      try {
        const { category, tag } = req.query;
        const expenses = await service.getAll({ category, tag });
        return ok(res, 200, expenses);
      } catch (err) {
        return handleError(res, err);
      }
    },

    async summary(req, res) {
      try {
        const data = await service.getSummary();
        return ok(res, 200, data);
      } catch (err) {
        return handleError(res, err);
      }
    },

    async getOne(req, res) {
      const id = parseId(req.params.id);
      if (id === null) {
        return fail(res, 400, 'invalid expense id');
      }
      try {
        const expense = await service.getById(id);
        return ok(res, 200, expense);
      } catch (err) {
        return handleError(res, err);
      }
    },

    async create(req, res) {
      try {
        const expense = await service.create(req.body || {});
        return ok(res, 201, expense);
      } catch (err) {
        return handleError(res, err);
      }
    },

    async update(req, res) {
      const id = parseId(req.params.id);
      if (id === null) {
        return fail(res, 400, 'invalid expense id');
      }
      try {
        const expense = await service.update(id, req.body || {});
        return ok(res, 200, expense);
      } catch (err) {
        return handleError(res, err);
      }
    },

    async remove(req, res) {
      const id = parseId(req.params.id);
      if (id === null) {
        return fail(res, 400, 'invalid expense id');
      }
      try {
        await service.delete(id);
        return ok(res, 200, undefined, 'expense deleted');
      } catch (err) {
        return handleError(res, err);
      }
    },
  };
}

module.exports = { createExpenseHandler, parseId };
