import { Op, col, fn } from 'sequelize';
import { User, Currency } from './mongo/models.js';
import { Category, Transaction, Budget, Audit } from './mysql/models.js';

const plain = value => value?.toJSON ? value.toJSON() : value;
const normalizeUser = value => {
  if (!value) return null;
  const rawId = value._id ?? value.id;
  if (!rawId || String(rawId) === 'undefined' || String(rawId) === 'null') throw new Error('MongoDB devolvió un usuario sin _id');
  return {
    id: String(rawId),
    name: value.name,
    email: value.email,
    password: value.password,
    role: value.role,
    baseCurrency: value.baseCurrency,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
};
const transactionDateFilter = ({ startDate, endDate } = {}) => startDate || endDate
  ? { date: { ...(startDate ? { [Op.gte]: startDate } : {}), ...(endDate ? { [Op.lte]: endDate } : {}) } }
  : {};

export function createRepositories() {
  return {
    users: {
      findByEmail: async email => normalizeUser(await User.findOne({ email }).lean()),
      findById: async id => normalizeUser(await User.findById(id).lean()),
      create: async data => normalizeUser(await User.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        baseCurrency: data.baseCurrency
      }))
    },
    categories: {
      list: async () => (await Category.findAll({ order: [['type', 'ASC'], ['name', 'ASC']] })).map(plain),
      findById: async id => plain(await Category.findByPk(id)),
      create: async data => plain(await Category.create(data)),
      update: async (id, data) => {
        const category = await Category.findByPk(id);
        return category ? plain(await category.update(data)) : null;
      },
      remove: async id => {
        const category = await Category.findByPk(id);
        if (!category) return false;
        await category.destroy();
        return true;
      }
    },
    transactions: {
      list: async (userId, query = {}) => (await Transaction.findAll({
        where: { userId, ...(query.type ? { type: query.type } : {}), ...transactionDateFilter(query) },
        order: [['date', 'DESC'], ['id', 'DESC']]
      })).map(plain),
      create: async data => plain(await Transaction.create(data)),
      findOwned: async (id, userId) => plain(await Transaction.findOne({ where: { id, userId } })),
      updateOwned: async (id, userId, data) => {
        const transaction = await Transaction.findOne({ where: { id, userId } });
        if (!transaction) return null;
        const date = data.date || transaction.date;
        const currency = (data.currency || transaction.currency).toUpperCase();
        const amount = Number(data.amount ?? transaction.amount);
        const exchangeRate = Number(data.exchangeRate ?? transaction.exchangeRate);
        return plain(await transaction.update({
          ...data,
          currency,
          date,
          amount,
          exchangeRate,
          convertedAmount: Number((amount * exchangeRate).toFixed(2))
        }));
      },
      removeOwned: async (id, userId) => {
        const deletedCount = await Transaction.destroy({ where: { id, userId } });
        return deletedCount > 0;
      },
      usesCategory: async categoryId => (await Transaction.count({ where: { categoryId } })) > 0,
      sumExpenses: async (userId, categoryId, month, year) => Number(await Transaction.sum('convertedAmount', {
        where: {
          userId,
          categoryId,
          type: 'EXPENSE',
          date: { [Op.between]: [`${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-31`] }
        }
      }) || 0),
      summary: async (userId, query = {}) => {
        const rows = await Transaction.findAll({
          attributes: ['type', [fn('SUM', col('converted_amount')), 'total']],
          where: { userId, ...transactionDateFilter(query) },
          group: ['type'],
          raw: true
        });
        const totalIncome = Number(rows.find(row => row.type === 'INCOME')?.total || 0);
        const totalExpense = Number(rows.find(row => row.type === 'EXPENSE')?.total || 0);
        return { totalIncome, totalExpense, balance: Number((totalIncome - totalExpense).toFixed(2)) };
      },
      byCategory: async (userId, query = {}) => Transaction.findAll({
        attributes: ['categoryId', 'type', [fn('SUM', col('converted_amount')), 'total'], [fn('COUNT', col('id')), 'count']],
        where: { userId, ...transactionDateFilter(query) },
        group: ['categoryId', 'type'],
        raw: true
      }),
      byExchangeRate: async userId => Transaction.findAll({
        attributes: ['currency', 'exchangeRateDate', 'exchangeRate', 'currencyRateId', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'totalOriginal'], [fn('SUM', col('converted_amount')), 'totalConverted']],
        where: { userId },
        group: ['currency', 'exchangeRateDate', 'exchangeRate', 'currencyRateId'],
        raw: true
      })
    },
    budgets: {
      list: async userId => (await Budget.findAll({ where: { userId }, include: [{ model: Category, as: 'category' }] })).map(plain),
      upsert: async data => {
        const where = { userId: data.userId, categoryId: data.categoryId, month: data.month, year: data.year };
        const [budget, created] = await Budget.findOrCreate({ where, defaults: { ...where, amountLimit: data.amountLimit } });
        if (!created && Number(budget.amountLimit) !== data.amountLimit) await budget.update({ amountLimit: data.amountLimit });
        return plain(budget);
      },
      removeOwned: async (id, userId) => {
        const deletedCount = await Budget.destroy({ where: { id, userId } });
        return deletedCount > 0;
      }
    },
    currencies: {
      list: () => Currency.find().sort({ code: 1, date: -1 }).lean(),
      findByCodeAndDate: async (code, date) => {
        const currency = await Currency.findOne({ code, date }).lean();
        return currency && { ...currency, id: String(currency._id) };
      },
      create: async data => plain(await Currency.create(data)),
      findByDate: date => Currency.find({ date }).sort({ code: 1 }).lean()
    },
    audits: {
      create: async data => plain(await Audit.create(data)),
      listByUser: async userId => (await Audit.findAll({ where: { userId }, order: [['createdAt', 'DESC']] })).map(plain)
    }
  };
}
