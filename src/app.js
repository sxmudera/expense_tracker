const express = require('express');
const cors = require('cors');
const path = require('path');
const { createExpenseHandler } = require('./handler/expense.handler');
const createExpenseRoutes = require('./routes/expense.routes');
const { ExpenseService } = require('./service/expense.service');

function createApp(repo) {
  const service = new ExpenseService(repo);
  const handler = createExpenseHandler(service);

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'expense-tracker' });
  });

  app.use('/api/expenses', createExpenseRoutes(handler));

  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'route not found' });
  });


  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large' || err.status === 413) {
      return res
        .status(413)
        .json({ success: false, message: 'payload too large' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res
        .status(400)
        .json({ success: false, message: 'invalid JSON body' });
    }
    console.error('Unhandled error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'internal server error' });
  });

  return app;
}

module.exports = createApp;
