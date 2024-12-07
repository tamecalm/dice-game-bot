const { Telegraf, Markup } = require('telegraf');
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
withdrawalCommand(bot); // Registers /withdrawal and any related actions
referralCommand(bot);  // Registers /referral and any related actions
adminCommand(bot);     // Registers /admin and any related actions

// Main menu with inline buttons
bot.command('menu', (ctx) => {
  ctx.reply(
    '💡 <b>Main Menu</b>\nChoose an option below:',
    Markup.inlineKeyboard([
      [Markup.button.callback('💰 Deposit', 'deposit')],
      [Markup.button.callback('🎮 Play', 'play')],
      [Markup.button.callback('📊 Balance', 'balance')],
      [Markup.button.callback('🏦 Withdrawal', 'withdrawal')],
      [Markup.button.callback('👥 Referral', 'referral')],
      [Markup.button.callback('🛠 Admin Panel', 'admin')],
    ]).extra({ parse_mode: 'HTML' })
  );
});

// Inline button handlers
bot.action('deposit', (ctx) => depositCommand(bot, ctx));
bot.action('play', (ctx) => playCommand(bot, ctx));
bot.action('balance', (ctx) => balanceCommand(bot, ctx));
bot.action('withdrawal', (ctx) => withdrawalCommand(bot, ctx));
bot.action('referral', (ctx) => referralCommand(bot, ctx));
bot.action('admin', (ctx) => adminCommand(bot, ctx));

// Handle unrecognized commands or general text
bot.on('text', (ctx) => {
  ctx.replyWithHTML(
    '❌ <b>Unknown command or input.</b>\nUse <code>/menu</code> to see available options.'
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
