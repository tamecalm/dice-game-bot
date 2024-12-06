// Import dependencies
const express = require('express');
const { Telegraf } = require('telegraf');  // Ensure Telegraf is correctly imported
const connectDb = require('./db');
const settings = require('./settings');
const paystackWebhook = require('../webhook/paystack');

// Initialize the Express app
const app = express();

// Middleware setup (if required)
app.use(express.json()); // To parse JSON requests (like Paystack webhooks)

// Define routes
app.use('/webhook', paystackWebhook);

// Initialize Telegraf bot with your bot token
const bot = new Telegraf(settings.botToken);  // Ensure settings.botToken is defined properly

// Async function to start the bot and connect to the database
(async () => {
  try {
    // Connect to the database
    await connectDb();
    console.log('📦 Database connected successfully.');

    // Start the bot (use bot.start() for Telegraf v4)
    bot.start((ctx) => ctx.reply('Bot is now online!'));  // Example start handler
    bot.launch();  // Launch the bot
    console.log('🤖 Bot is up and running.');

  } catch (error) {
    // Log any error during the startup process
    console.error('❌ Error launching the bot:', error);
    process.exit(1);
  }
})();

// Graceful shutdown for SIGINT and SIGTERM
process.once('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  bot.stop('SIGTERM');
});

// Set up the server to listen for incoming HTTP requests (important if you're using Express)
const port = process.env.PORT || 3000; // Default to 3000 if no environment variable is set
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});

