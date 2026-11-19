import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Op } from 'sequelize';
import { createApp } from '../../src/app.js';
import { connectDatabases, closeDatabases } from '../../src/infrastructure/database/connect.js';
import { User } from '../../src/infrastructure/database/mongo/models.js';
import { Audit, Budget, Category, Transaction } from '../../src/infrastructure/database/mysql/models.js';

const enabled = process.env.RUN_DB_INTEGRATION === 'true';
const integrationSkip = enabled ? false : 'Set RUN_DB_INTEGRATION=true and configure isolated MongoDB/MySQL databases ending in _test.';

function assertIsolatedDatabaseNames() {
  const databaseName = process.env.MYSQL_DB || '';
  let mongoDatabase = '';
  try { mongoDatabase = new URL(process.env.MONGO_URI).pathname.slice(1); } catch { /* checked below */ }
  if (!/(^|[_-])test$/i.test(databaseName) || !/(^|[_-])test$/i.test(mongoDatabase)) {
    throw new Error('Integration tests are restricted to databases whose names end in _test. Refusing to connect.');
  }
}

async function request(base, path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
}

test('MongoDB/MySQL integration: persist users, enforce ownership, and use real category FKs for transactions, budgets and reports', { skip: integrationSkip }, async () => {
  assertIsolatedDatabaseNames();
  assert.ok(process.env.JWT_SECRET?.length >= 32, 'JWT_SECRET must contain at least 32 characters');
  let server;
  let connected = false;
  const createdUserIds = [];
  const createdUserSubs = [];
  const createdCategoryIds = [];
  const ownerId = `integration-${randomUUID()}`;
  const categoryLabel = `integration-${randomUUID()}`;
  try {
    await connectDatabases();
    connected = true;
    const app = createApp({ env: process.env });
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    const first = await request(base, '/api/v1/auth/register', { method: 'POST', body: { name: 'Integration One', email: `${ownerId}@example.test`, password: 'integration-password-1' } });
    assert.equal(first.status, 201);
    const firstSub = JSON.parse(Buffer.from(first.body.token.split('.')[1], 'base64url').toString()).sub;
    assert.ok(firstSub && firstSub !== 'undefined');
    createdUserIds.push(new mongoose.Types.ObjectId(firstSub));
    createdUserSubs.push(firstSub);

    const second = await request(base, '/api/v1/auth/register', { method: 'POST', body: { name: 'Integration Two', email: `${ownerId}-two@example.test`, password: 'integration-password-2' } });
    assert.equal(second.status, 201);
    const secondSub = JSON.parse(Buffer.from(second.body.token.split('.')[1], 'base64url').toString()).sub;
    assert.ok(secondSub && secondSub !== 'undefined');
    assert.notEqual(firstSub, secondSub);
    createdUserIds.push(new mongoose.Types.ObjectId(secondSub));
    createdUserSubs.push(secondSub);

    const login = await request(base, '/api/v1/auth/login', { method: 'POST', body: { email: `${ownerId}@example.test`, password: 'integration-password-1' } });
    assert.equal(login.status, 200);
    assert.equal(JSON.parse(Buffer.from(login.body.token.split('.')[1], 'base64url').toString()).sub, firstSub);
    assert.equal((await request(base, '/api/v1/auth/login', { method: 'POST', body: { email: `${ownerId}@example.test`, password: 'wrong-password' } })).status, 401);
    assert.equal((await request(base, '/api/v1/auth/register', { method: 'POST', body: { name: 'Duplicate', email: `${ownerId}@example.test`, password: 'integration-password-1' } })).status, 409);
    assert.equal((await request(base, '/api/v1/auth/me', { token: login.body.token })).body.id, firstSub);
    assert.ok((await User.findById(firstSub).lean()).password.startsWith('$2'));

    const incomeCategory = await Category.create({ name: `${categoryLabel}-income`, type: 'INCOME' });
    const expenseCategory = await Category.create({ name: `${categoryLabel}-expense`, type: 'EXPENSE' });
    const alternateExpenseCategory = await Category.create({ name: `${categoryLabel}-expense-updated`, type: 'EXPENSE' });
    createdCategoryIds.push(incomeCategory.id, expenseCategory.id, alternateExpenseCategory.id);
    const income = await request(base, '/api/v1/transactions', { method: 'POST', token: login.body.token, body: { type: 'INCOME', amount: 500, currency: 'BOB', categoryId: incomeCategory.id, date: '2026-11-19' } });
    const expense = await request(base, '/api/v1/transactions', { method: 'POST', token: login.body.token, body: { type: 'EXPENSE', amount: 75, currency: 'BOB', categoryId: expenseCategory.id, date: '2026-11-19' } });
    assert.equal(income.status, 201);
    assert.equal(expense.status, 201);
    assert.equal(income.body.categoryId, incomeCategory.id);
    assert.equal(expense.body.categoryId, expenseCategory.id);
    const persistedExpense = await Transaction.findByPk(expense.body.id);
    assert.equal(persistedExpense.categoryId, expenseCategory.id);
    assert.equal(persistedExpense.getDataValue('categoryId'), expenseCategory.id);
    const updatedExpense = await request(base, `/api/v1/transactions/${expense.body.id}`, { method: 'PUT', token: login.body.token, body: { amount: 80, categoryId: alternateExpenseCategory.id } });
    assert.equal(updatedExpense.status, 200);
    assert.equal(updatedExpense.body.categoryId, alternateExpenseCategory.id);
    assert.equal(Number((await Transaction.findByPk(expense.body.id)).amount), 80);
    assert.equal((await request(base, '/api/v1/transactions', { token: second.body.token })).body.length, 0);
    assert.equal((await request(base, `/api/v1/transactions/${expense.body.id}`, { method: 'DELETE', token: second.body.token })).status, 404);

    const budget = await request(base, '/api/v1/budgets', { method: 'POST', token: login.body.token, body: { categoryId: alternateExpenseCategory.id, month: 11, year: 2026, amountLimit: 100 } });
    assert.equal(budget.status, 201);
    assert.equal(budget.body.categoryId, alternateExpenseCategory.id);
    const persistedBudget = await Budget.findByPk(budget.body.id, { include: [{ model: Category, as: 'category' }] });
    assert.equal(persistedBudget.categoryId, alternateExpenseCategory.id);
    assert.equal(persistedBudget.category.id, alternateExpenseCategory.id);
    const budgets = await request(base, '/api/v1/budgets', { token: login.body.token });
    assert.equal(Number(budgets.body[0].spent), 80);
    assert.equal(budgets.body[0].exceeded, false);

    const summary = await request(base, '/api/v1/reports/summary', { token: login.body.token });
    assert.equal(summary.body.totalIncome, 500);
    assert.equal(summary.body.totalExpense, 80);
    const grouped = await request(base, '/api/v1/reports/by-category', { token: login.body.token });
    assert.ok(grouped.body.some(row => Number(row.categoryId) === alternateExpenseCategory.id));
    assert.ok((await request(base, '/api/v1/reports/audits', { token: login.body.token })).body.length >= 2);

    assert.equal((await request(base, `/api/v1/transactions/${expense.body.id}`, { method: 'DELETE', token: login.body.token })).body.deleted, true);
    assert.equal((await request(base, '/api/v1/transactions/999999', { method: 'DELETE', token: login.body.token })).status, 404);
    assert.equal(await Transaction.count({ where: { id: expense.body.id, userId: firstSub } }), 0);
    assert.equal((await request(base, `/api/v1/budgets/${budget.body.id}`, { method: 'DELETE', token: second.body.token })).status, 404);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (connected) {
      try {
        if (createdCategoryIds.length) {
          await Transaction.destroy({ where: { categoryId: createdCategoryIds } });
          await Budget.destroy({ where: { categoryId: createdCategoryIds } });
          await Category.destroy({ where: { id: createdCategoryIds } });
        }
        if (createdUserSubs.length) await Audit.destroy({ where: { userId: { [Op.in]: createdUserSubs } } });
        if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
      } finally {
        await closeDatabases();
      }
    } else {
      await closeDatabases();
    }
  }
});
