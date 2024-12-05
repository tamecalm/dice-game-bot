const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  totalDeposits: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);