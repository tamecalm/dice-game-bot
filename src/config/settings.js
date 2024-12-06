require('dotenv').config();

module.exports = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  dbUri: process.env.MONGO_URI,
  adminIds: process.env.ADMIN_ID,
  defaultCurrency: 'USD',
  minimumDeposit: 1, //
  vatRate: 5, // VAT percentage
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY
};
