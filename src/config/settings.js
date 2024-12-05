require('dotenv').config();

module.exports = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  dbUri: process.env.MONGO_URI,
  adminId: process.env.ADMIN_ID,
  defaultCurrency: 'NGN',
  minimumDeposit: 1, // Naira equivalent
  vatRate: 5, // VAT percentage
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY
};
