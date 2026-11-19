import mongoose from 'mongoose';
import { sequelize } from './mysql/sequelize.js';
import './mysql/models.js';
export async function connectDatabases() { await Promise.all([mongoose.connect(process.env.MONGO_URI), sequelize.authenticate()]); await sequelize.sync(); }
export async function closeDatabases() { await Promise.allSettled([mongoose.disconnect(), sequelize.close()]); }
