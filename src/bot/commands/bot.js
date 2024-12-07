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
bot.command('start', startCommand);
bot.command('balance', balanceCommand);
bot.command('deposit', depositCommand);
playCommand(bot); // Registers /play and associated actions
bot.command('withdrawal', withdrawalCommand);
bot.command('referral', referralCommand);

// Admin-only command
bot.command('admin', (ctx) => {
  if (!settings.adminIds.includes(ctx.from.id)) {
    return ctx.reply('❌ You are not authorized to access the admin panel.');
  }
  return adminCommand(ctx);
});

// Register keyboard commands
bot.hears('💰 Deposit', depositCommand);
bot.hears('🎮 Play', (ctx) => {
  // Trigger the same logic as /play for consistency
  ctx.telegram.sendMessage(
    ctx.chat.id,
    '🎮 Use /play to start a game!'
  );
});
bot.hears('📊 Balance', balanceCommand);
bot.hears('🏦 Withdrawal', withdrawalCommand);
bot.hears('👥 Referral', referralCommand);

// Admin Panel (keyboard)
bot.hears('🛠 Admin Panel', (ctx) => {
  if (!settings.adminIds.includes(ctx.from.id)) {
    return ctx.reply('❌ You are not authorized to access the admin panel.');
  }
  return adminCommand(ctx);
});

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

// Launch the bot
// bot.launch();
// console.log('Bot is running...');

// Export the bot instance
module.exports = bot;
