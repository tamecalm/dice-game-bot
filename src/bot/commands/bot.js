const { Telegraf } = require('telegraf');
const settings = require('../../config/settings');

// Import command handlers
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');
const withdrawalCommand = require('./withdrawal');
const referralCommand = require('./referral');

// Initialize the bot
const bot = new Telegraf(settings.botToken);

// Register command handlers
startCommand(bot);     // Registers /start and any related actions
balanceCommand(bot);   // Registers /balance and any related actions
depositCommand(bot);   // Registers /deposit and any related actions
playCommand(bot);      // Registers /play and any related actions
withdrawalCommand(bot);// Registers /withdrawal and any related actions
referralCommand(bot);  // Registers /referral and any related actions
adminCommand(bot);     // Registers /admin and any related actions

// Register keyboard commands
bot.hears('💰 Deposit', (ctx) => depositCommand(bot, ctx));
bot.hears('🎮 Play', (ctx) => playCommand(bot, ctx));
bot.hears('📊 Balance', (ctx) => balanceCommand(bot, ctx));
bot.hears('🏦 Withdrawal', (ctx) => withdrawalCommand(bot, ctx));
bot.hears('👥 Referral', (ctx) => referralCommand(bot, ctx));

// Admin Panel (keyboard)
bot.hears('🛠 Admin Panel', (ctx) => adminCommand(bot, ctx));

// Handle unrecognized commands or general text
bot.on('text', (ctx) => {
  ctx.replyWithHTML(
    '❌ <b>Unknown command or input.</b>\nUse <code>/start</code> to see available commands.'
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
