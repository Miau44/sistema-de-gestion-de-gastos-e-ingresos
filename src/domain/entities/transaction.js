import AppError from '../errors/AppError.js';
export function validateTransaction(data) {
  if (!['INCOME', 'EXPENSE'].includes(data.type)) throw new AppError('type debe ser INCOME o EXPENSE');
  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) throw new AppError('amount debe ser mayor que cero');
  if (!data.categoryId) throw new AppError('categoryId es obligatorio');
  if (!/^[A-Z]{3}$/.test(data.currency || 'BOB')) throw new AppError('currency debe ser un código de tres letras');
  if (data.date && Number.isNaN(Date.parse(data.date))) throw new AppError('date no es válida');
}
