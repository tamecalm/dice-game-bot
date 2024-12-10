require('dotenv').config();

module.exports = {
  // Telegram Bot Token
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  // MongoDB Connection URI
  dbUri: process.env.MONGO_URI,
  // Admin User IDs
  adminIds: process.env.ADMIN_ID,
  // Default Currency for Transactions
  defaultCurrency: process.env.DEFAULT_CURRENCY,
  // Minimum Deposit Amount
  minimumDeposit: 100, // In the default currency
  // Minimum Bet Amount
  minBet: 1000, // In the default currency
  // Maximum Bet Amount
  maxBet: 5000, // In the default currency
  // Timeout for Matchmaking (in seconds)
  matchMakingTimeout: 20,
  // Value Added Tax (VAT) Rate
  vatRate: 5, // Percentage
  // Flutterwave Public Key
  flutterwavePublicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
  // Flutterwave Secret Key
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY,
  // Paystack Secret Key
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY
};

/*
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
  flutterwavePublicKey:
  flutterwaveSecretKey:
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY
};

*/
