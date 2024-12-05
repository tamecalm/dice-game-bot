require('dotenv').config();

module.exports = {
  botToken: process.env.BOT_TOKEN,
  dbUri: process.env.MONGO_URI,
  adminId: process.env.ADMIN_ID,
  defaultCurrency: 'NGN',
  minimumDeposit: 1000, // Naira equivalent
  vatRate: 5, // VAT percentage
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY
};
