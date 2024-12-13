// ==========================================================================
// Dice Game Bot Project - Script Header
// ==========================================================================
//
// Project: Dice Game Bot
// Repository: https://github.com/tamecalm/dice-game-bot
// 
// Description: 
// A robust and extensible module designed for a multiplayer dice game bot. 
// Feel free to use, modify, or contribute to the project under the terms of the repository's license.
//
// Author: Engr John! 🧑‍💻
// Year: 2024
// 
// License: Licensed under the terms of the repository's license. Unauthorized duplication, 
// Modification, or distribution of this script outside the license terms is prohibited.
// ==========================================================================

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


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
