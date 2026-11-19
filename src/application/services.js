import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import AppError from '../domain/errors/AppError.js';
import { validateTransaction } from '../domain/entities/transaction.js';
import { createRepositories } from '../infrastructure/database/repositories.js';

export function createServices({ users, categories, transactions, budgets, currencies, audits, env = process.env } = {}) {
  if (!users) ({ users, categories, transactions, budgets, currencies, audits } = createRepositories());
  const token = (user) => jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN || '1d' });
  const audit = async (action, entity, entityId, userId, details = {}) => audits?.create({ action, entity, entityId: String(entityId), userId: String(userId), details });
  return {
    register: async ({ name, email, password, baseCurrency = 'BOB' }) => {
      if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8) throw new AppError('Nombre, correo válido y contraseña (mínimo 8 caracteres) son obligatorios');
      if (await users.findByEmail(email.toLowerCase())) throw new AppError('El correo ya está registrado', 409, 'EMAIL_EXISTS');
      const user = await users.create({ id: randomUUID(), name: name.trim(), email: email.toLowerCase(), password: await bcrypt.hash(password, 12), role: 'USER', baseCurrency });
      return { user: publicUser(user), token: token(user) };
    },
    login: async ({ email, password } = {}) => {
      if (typeof email !== 'string' || typeof password !== 'string') throw new AppError('Correo o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
      const user = await users.findByEmail((email || '').toLowerCase());
      if (!user || !(await bcrypt.compare(password || '', user.password))) throw new AppError('Correo o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
      return { user: publicUser(user), token: token(user) };
    },
    verify: (raw) => { try { return jwt.verify(raw, env.JWT_SECRET); } catch { throw new AppError('Token inválido o expirado', 401, 'UNAUTHORIZED'); } },
    me: async (id) => { const user = await users.findById(id); if (!user) throw new AppError('Usuario no encontrado', 404); return publicUser(user); },
    listCategories: () => categories.list(),
    createCategory: async (data) => { if (!data.name?.trim() || !['INCOME', 'EXPENSE'].includes(data.type)) throw new AppError('name y type válido son obligatorios'); return categories.create({ name: data.name.trim(), type: data.type }); },
    updateCategory: async (id, data) => { if (data.type && !['INCOME', 'EXPENSE'].includes(data.type)) throw new AppError('type debe ser INCOME o EXPENSE'); const updated = await categories.update(id, data); if (!updated) throw new AppError('Categoría no encontrada', 404); return updated; },
    deleteCategory: async (id) => { if (await transactions.usesCategory(id)) throw new AppError('La categoría tiene transacciones asociadas', 409); if (!(await categories.remove(id))) throw new AppError('Categoría no encontrada', 404); return { deleted: true }; },
    listTransactions: (userId, query) => transactions.list(userId, query),
    createTransaction: async (userId, data) => { validateTransaction(data); const category = await categories.findById(data.categoryId); if (!category) throw new AppError('Categoría no encontrada', 400); if (category.type !== data.type) throw new AppError('La categoría no corresponde al tipo de transacción'); const date = data.date || new Date().toISOString().slice(0, 10); const currency = (data.currency || 'BOB').toUpperCase(); const rate = await currencies.findByCodeAndDate(currency, date); if (currency !== 'BOB' && !rate) throw new AppError(`No existe un tipo de cambio registrado para ${currency} en ${date}`, 400, 'EXCHANGE_RATE_NOT_FOUND'); const exchangeRate = rate?.exchangeRate ?? 1; const row = await transactions.create({ ...data, userId, currency, date, exchangeRate, exchangeRateDate: rate?.date || date, currencyRateId: rate?.id || null, convertedAmount: Number((Number(data.amount) * exchangeRate).toFixed(2)) }); await audit('CREATE', 'TRANSACTION', row.id, userId, row); return row; },
    updateTransaction: async (userId, id, data) => { const old = await transactions.findOwned(id, userId); if (!old) throw new AppError('Transacción no encontrada', 404); const allowed = Object.fromEntries(['type','amount','categoryId','currency','date','description'].filter(key => data[key] !== undefined).map(key => [key, data[key]])); const next = { ...old, ...allowed }; validateTransaction(next); const category = await categories.findById(next.categoryId); if (!category || category.type !== next.type) throw new AppError('Categoría no encontrada o no corresponde al tipo'); const currency = (next.currency || 'BOB').toUpperCase(), date = next.date || new Date().toISOString().slice(0, 10); const rate = await currencies.findByCodeAndDate(currency, date); if (currency !== 'BOB' && !rate) throw new AppError(`No existe un tipo de cambio registrado para ${currency} en ${date}`, 400, 'EXCHANGE_RATE_NOT_FOUND'); const exchangeRate = rate?.exchangeRate ?? 1; const updated = await transactions.updateOwned(id, userId, { ...allowed, currency, date, exchangeRate, exchangeRateDate: rate?.date || date, currencyRateId: rate?.id || null, convertedAmount: Number((Number(next.amount) * exchangeRate).toFixed(2)) }); await audit('UPDATE', 'TRANSACTION', id, userId, { previous: old, updated }); return updated; },
    deleteTransaction: async (userId, id) => { const old = await transactions.findOwned(id, userId); if (!old) throw new AppError('Transacción no encontrada', 404); await transactions.removeOwned(id, userId); await audit('DELETE', 'TRANSACTION', id, userId, old); return { deleted: true }; },
    listCurrencies: () => currencies.list(),
    createCurrency: async (data) => { if (!/^[A-Z]{3}$/.test(data.code || '') || !data.name || !Number.isFinite(Number(data.exchangeRate)) || Number(data.exchangeRate) <= 0 || !data.date || Number.isNaN(Date.parse(data.date))) throw new AppError('code, name, exchangeRate positivo y date válidos son obligatorios'); return currencies.create({ ...data, code: data.code.toUpperCase(), exchangeRate: Number(data.exchangeRate), source: data.source || 'user-provided' }); },
    currenciesByDate: (date) => { if (!date || Number.isNaN(Date.parse(date))) throw new AppError('date debe ser una fecha válida'); return currencies.findByDate(date); },
    createBudget: async (userId, data) => { if (!data.categoryId || !Number.isInteger(Number(data.month)) || data.month < 1 || data.month > 12 || !Number.isInteger(Number(data.year)) || !Number.isFinite(Number(data.amountLimit)) || Number(data.amountLimit) <= 0) throw new AppError('categoryId, mes, año y monto positivo válidos son obligatorios'); const cat = await categories.findById(data.categoryId); if (!cat || cat.type !== 'EXPENSE') throw new AppError('El presupuesto requiere una categoría de gasto'); return budgets.upsert({ ...data, userId, month: Number(data.month), year: Number(data.year), amountLimit: Number(data.amountLimit) }); },
    listBudgets: async (userId) => Promise.all((await budgets.list(userId)).map(async b => ({ ...b, spent: await transactions.sumExpenses(userId, b.categoryId, b.month, b.year), exceeded: await transactions.sumExpenses(userId, b.categoryId, b.month, b.year) > Number(b.amountLimit) }))),
    deleteBudget: async (userId, id) => { if (!(await budgets.removeOwned(id, userId))) throw new AppError('Presupuesto no encontrado', 404); return { deleted: true }; },
    summary: (userId, query) => transactions.summary(userId, query),
    byCategory: (userId, query) => transactions.byCategory(userId, query),
    byExchangeRate: (userId) => transactions.byExchangeRate(userId),
    reportAudits: (userId) => audits.listByUser(userId)
  };
}
function publicUser(user) { const { password, ...safe } = user; return safe; }
