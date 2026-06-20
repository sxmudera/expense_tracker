const express = require('express');

/**
 * Builds an /api/expenses router bound to the given handler.
 * NOTE: /summary must be registered before /:id, otherwise
 * Express would try to match "summary" as an :id param.
 */
function createExpenseRoutes(handler) {
  const router = express.Router();

  router.get('/summary', handler.summary);
  router.get('/', handler.list);
  router.post('/', handler.create);
  router.get('/:id', handler.getOne);
  router.put('/:id', handler.update);
  router.delete('/:id', handler.remove);

  return router;
}

module.exports = createExpenseRoutes;
