import { DataTypes } from 'sequelize';
import { sequelize } from './sequelize.js';

export const Category = sequelize.define('Category', {
  name: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.ENUM('INCOME', 'EXPENSE'), allowNull: false }
}, { indexes: [{ unique: true, fields: ['name', 'type'] }] });

export const Transaction = sequelize.define('Transaction', {
  userId: { type: DataTypes.STRING(64), allowNull: false, index: true },
  type: { type: DataTypes.ENUM('INCOME', 'EXPENSE'), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false },
  exchangeRate: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
  exchangeRateDate: { type: DataTypes.DATEONLY, allowNull: false },
  currencyRateId: DataTypes.STRING(64),
  convertedAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  description: DataTypes.STRING(500),
  date: { type: DataTypes.DATEONLY, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: false, field: 'category_id' }
});

export const Budget = sequelize.define('Budget', {
  userId: { type: DataTypes.STRING(64), allowNull: false },
  month: { type: DataTypes.INTEGER, allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false },
  amountLimit: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: false, field: 'category_id' }
}, { indexes: [{ unique: true, fields: ['user_id', 'category_id', 'month', 'year'] }] });

export const Audit = sequelize.define('Audit', {
  userId: { type: DataTypes.STRING(64), allowNull: false },
  action: { type: DataTypes.STRING(80), allowNull: false },
  entity: { type: DataTypes.STRING(80), allowNull: false },
  entityId: DataTypes.STRING(64),
  details: DataTypes.JSON
});

Category.hasMany(Transaction, { foreignKey: 'categoryId', as: 'transactions', onDelete: 'RESTRICT' });
Transaction.belongsTo(Category, { foreignKey: 'categoryId', as: 'category', onDelete: 'RESTRICT' });
Category.hasMany(Budget, { foreignKey: 'categoryId', as: 'budgets', onDelete: 'RESTRICT' });
Budget.belongsTo(Category, { foreignKey: 'categoryId', as: 'category', onDelete: 'RESTRICT' });
