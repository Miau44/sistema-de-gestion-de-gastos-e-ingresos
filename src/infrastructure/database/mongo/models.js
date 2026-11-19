import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({ name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true }, password: { type: String, required: true, select: true }, role: { type: String, enum: ['USER','ADMIN'], default: 'USER' }, baseCurrency: { type: String, default: 'BOB' } }, { timestamps: true });
const currencySchema = new mongoose.Schema({ code: { type: String, required: true, uppercase: true }, name: { type: String, required: true }, exchangeRate: { type: Number, required: true, min: 0.000001 }, date: { type: String, required: true }, source: { type: String, required: true } }, { timestamps: true });
currencySchema.index({ code: 1, date: 1 }, { unique: true });
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Currency = mongoose.models.Currency || mongoose.model('Currency', currencySchema);
