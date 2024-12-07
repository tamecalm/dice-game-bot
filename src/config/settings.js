require('dotenv').config();

module.exports = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  dbUri: process.env.MONGO_URI,
  adminIds: process.env.ADMIN_ID,
  defaultCurrency: process.env.DEFAULT_CURRENCY,
  minimumDeposit: 1,
  minBet: 1000,
  maxBet: 5000,
  matchMakingTimeout: 20,
  vatRate: 5, // VAT percentage
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY
};
