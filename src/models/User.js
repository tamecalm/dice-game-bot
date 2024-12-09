const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'NGN' },
  totalDeposits: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  country: { type: String }, // New field to store the user's country
  referralCode: { type: String },
  referredBy: { type: String }, // User ID of the referrer, if applicable
  state: { type: String }, // Track current user state (e.g., 'withdrawing', 'depositing')
  tempAmount: { type: Number }, // Temporary amount for withdrawals
  usdtAddress: { type: String }, // User's USDT address
  referralEarnings: { type: Number, default: 0 }, // Total referral earnings
  lastLogin: { type: Date }, // Last login timestamp
  firstDeposit: { type: Date }, // First deposit timestamp (used for referral rewards)
});

module.exports = mongoose.model('User', userSchema);
