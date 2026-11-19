import { Router } from 'express';
import AppError from '../domain/errors/AppError.js';

export function createApi(s, env = process.env) {
  const r = Router();
  const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const auth = (req, _res, next) => { const value = req.headers.authorization || ''; if (!value.startsWith('Bearer ')) return next(new AppError('Se requiere Bearer token', 401, 'UNAUTHORIZED')); try { req.user = s.verify(value.slice(7)); next(); } catch (e) { next(e); } };
  const admin = (req, _res, next) => req.user?.role === 'ADMIN' ? next() : next(new AppError('Se requiere rol ADMIN', 403, 'FORBIDDEN'));
  const endpoint = (action, status = 200) => asyncRoute(async (req, res) => res.status(status).json(await action(req)));
  r.post('/auth/register', endpoint(req => s.register(req.body || {}), 201));
  r.post('/auth/login', endpoint(req => s.login(req.body || {})));
  r.get('/auth/me', auth, endpoint(req => s.me(req.user.sub)));
  r.get('/categories', auth, endpoint(() => s.listCategories()));
  r.post('/categories', auth, admin, endpoint(req => s.createCategory(req.body || {}), 201));
  r.put('/categories/:id', auth, admin, endpoint(req => s.updateCategory(req.params.id, req.body || {})));
  r.delete('/categories/:id', auth, admin, endpoint(req => s.deleteCategory(req.params.id)));
  r.get('/transactions', auth, endpoint(req => s.listTransactions(req.user.sub, req.query)));
  r.post('/transactions', auth, endpoint(req => s.createTransaction(req.user.sub, req.body || {}), 201));
  r.put('/transactions/:id', auth, endpoint(req => s.updateTransaction(req.user.sub, req.params.id, req.body || {})));
  r.delete('/transactions/:id', auth, endpoint(req => s.deleteTransaction(req.user.sub, req.params.id)));
  r.get('/currencies', endpoint(() => s.listCurrencies()));
  r.post('/currencies', auth, admin, endpoint(req => s.createCurrency(req.body || {}), 201));
  r.get('/currencies/by-date', endpoint(req => { if (!req.query.date) throw new AppError('date es obligatorio'); return s.currenciesByDate(req.query.date); }));
  r.get('/budgets', auth, endpoint(req => s.listBudgets(req.user.sub)));
  r.post('/budgets', auth, endpoint(req => s.createBudget(req.user.sub, req.body || {}), 201));
  r.delete('/budgets/:id', auth, endpoint(req => s.deleteBudget(req.user.sub, req.params.id)));
  r.get('/reports/summary', auth, endpoint(req => s.summary(req.user.sub, req.query)));
  r.get('/reports/by-category', auth, endpoint(req => s.byCategory(req.user.sub, req.query)));
  r.get('/reports/by-exchange-rate', auth, endpoint(req => s.byExchangeRate(req.user.sub)));
  r.get('/reports/audits', auth, endpoint(req => s.reportAudits(req.user.sub)));
  return r;
}
