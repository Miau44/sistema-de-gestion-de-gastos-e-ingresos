import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../src/infrastructure/database/mongo/models.js';
import { Budget, Category, Transaction } from '../src/infrastructure/database/mysql/models.js';
import { createRepositories } from '../src/infrastructure/database/repositories.js';
import { createServices } from '../src/application/services.js';

test('Mongoose user repository queries by email and normalizes Mongo _id for JWT sub', async () => {
  const originalFindOne = User.findOne;
  const originalFindById = User.findById;
  const originalCreate = User.create;
  const firstId = new mongoose.Types.ObjectId();
  const secondId = new mongoose.Types.ObjectId();
  const persisted = [];
  User.findOne = filter => {
    assert.equal(typeof filter.email, 'string');
    assert.equal(Object.hasOwn(filter, 'where'), false);
    return { lean: async () => persisted.find(user => user.email === filter.email) || null };
  };
  User.create = async data => {
    const user = { ...data, _id: persisted.length === 0 ? firstId : persisted.length === 1 ? secondId : new mongoose.Types.ObjectId() };
    persisted.push(user);
    return user;
  };
  User.findById = id => {
    assert.equal(String(id), String(firstId));
    return { lean: async () => persisted[0] || null };
  };
  try {
    const repos = createRepositories();
    const first = await repos.users.create({ name: 'One', email: 'one@example.com', password: 'hash', role: 'USER', baseCurrency: 'BOB' });
    const second = await repos.users.create({ name: 'Two', email: 'two@example.com', password: 'hash', role: 'USER', baseCurrency: 'BOB' });
    assert.equal(first.id, String(firstId));
    assert.equal(second.id, String(secondId));
    assert.notEqual(first.id, second.id);
    const found = await repos.users.findByEmail('one@example.com');
    assert.equal(found.id, String(firstId));
    assert.equal((await repos.users.findById(firstId)).id, String(firstId));

    const services = createServices({ ...repos, env: { JWT_SECRET: 'repository-test-secret-at-least-32-characters', JWT_EXPIRES_IN: '1d' } });
    const result = await services.login({ email: found.email, password: 'not-the-stored-hash' }).catch(error => error);
    assert.equal(result.status, 401);
    const registered = await services.register({ name: 'Three', email: 'three@example.com', password: 'password123' });
    const tokenPayload = services.verify(registered.token);
    assert.equal(tokenPayload.sub, registered.user.id);
    assert.ok(tokenPayload.sub);
    assert.notEqual(tokenPayload.sub, 'undefined');
    const loggedIn = await services.login({ email: 'three@example.com', password: 'password123' });
    assert.equal(services.verify(loggedIn.token).sub, registered.user.id);
    await assert.rejects(services.login({ email: 'three@example.com', password: 'wrong-password' }), { status: 401 });
    const another = await services.register({ name: 'Four', email: 'four@example.com', password: 'password123' });
    const anotherSub = services.verify(another.token).sub;
    assert.ok(anotherSub && anotherSub !== 'undefined');
    assert.notEqual(anotherSub, tokenPayload.sub);
  } finally {
    User.findOne = originalFindOne;
    User.findById = originalFindById;
    User.create = originalCreate;
  }
});

test('Mongoose user repository rejects a document without Mongo _id instead of returning undefined', async () => {
  const originalCreate = User.create;
  User.create = async data => data;
  try {
    const repos = createRepositories();
    await assert.rejects(repos.users.create({ name: 'Missing ID', email: 'missing@example.com', password: 'hash', role: 'USER', baseCurrency: 'BOB' }), /sin _id/);
  } finally {
    User.create = originalCreate;
  }
});

test('MySQL transaction delete awaits Sequelize destroy and distinguishes zero rows and DB errors', async () => {
  const originalDestroy = Transaction.destroy;
  try {
    const repos = createRepositories();
    Transaction.destroy = async options => { assert.deepEqual(options.where, { id: 9, userId: 'owner-1' }); await new Promise(resolve => setTimeout(resolve, 5)); return 1; };
    assert.equal(await repos.transactions.removeOwned(9, 'owner-1'), true);
    Transaction.destroy = async () => 0;
    assert.equal(await repos.transactions.removeOwned(9, 'owner-1'), false);
    Transaction.destroy = async () => { throw new Error('database unavailable'); };
    await assert.rejects(repos.transactions.removeOwned(9, 'owner-1'), /database unavailable/);
  } finally {
    Transaction.destroy = originalDestroy;
  }
});

test('Sequelize declares one categoryId attribute and FK for transactions and budgets', () => {
  for (const model of [Transaction, Budget]) {
    assert.ok(model.rawAttributes.categoryId);
    assert.equal(model.rawAttributes.categoryId.field, 'category_id');
    assert.equal(model.rawAttributes.categoryId.allowNull, false);
    assert.equal(model.rawAttributes.categoryId.references.model, Category.getTableName());
    assert.equal(model.rawAttributes.categoryId.references.key, 'id');
    assert.equal(model.associations.category.foreignKey, 'categoryId');
  }
});
