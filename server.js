require('dotenv').config();
const createApp = require('./src/app');
const pool = require('./src/config/db');
const ExpenseRepository = require('./src/repository/expense.repository');

const PORT = process.env.PORT || 3000;

const repo = new ExpenseRepository(pool);
const app = createApp(repo);

app.listen(PORT, () => {
  console.log(`Expense Tracker running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET    /api/expenses              - List all expenses');
  console.log('  GET    /api/expenses?category=xxx - Filter by category');
  console.log('  GET    /api/expenses?tag=xxx       - Filter by tag');
  console.log('  GET    /api/expenses/summary       - Totals & breakdown');
  console.log('  POST   /api/expenses              - Create expense');
  console.log('  GET    /api/expenses/:id          - Get expense');
  console.log('  PUT    /api/expenses/:id          - Update expense');
  console.log('  DELETE /api/expenses/:id          - Delete expense');
  console.log('  GET    /health                    - Health check');
});
