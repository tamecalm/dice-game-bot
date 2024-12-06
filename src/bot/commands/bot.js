const { Telegraf } = require('telegraf');
const settings = require('../../config/settings');

// Import command handlers
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');
const withdrawalCommand = require('./withdrawal'); // New: withdrawal logic
const referralCommand = require('./referral');     // New: referral logic

// Initialize the bot
const bot = new Telegraf(settings.botToken);

// Register command handlers
bot.command('start', startCommand);
bot.command('balance', balanceCommand);
bot.command('deposit', depositCommand);
bot.command('play', playCommand);
bot.command('withdrawal', withdrawalCommand); // Register withdrawal command
bot.command('referral', referralCommand);     // Register referral command
bot.command('admin', adminCommand);

// Handle unrecognized commands or general text
bot.on('text', (ctx) => {
  ctx.replyWithHTML(
    '❌ <b>Unknown command.</b>\nUse <code>/start</code> to see available commands.'
  );
});

// Global error handler (optional but recommended)
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}:`, err.message);
  ctx.replyWithHTML(
    '❌ <b>An unexpected error occurred.</b>\nPlease try again later.'
  );
});

// Export the bot instance
module.exports = bot;
