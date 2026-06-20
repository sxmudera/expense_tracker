const express = require('express');

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
