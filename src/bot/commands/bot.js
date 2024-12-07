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

// Inline button handlers
bot.action('deposit', async (ctx) => {
  try {
    await depositCommand(bot, ctx);
  } catch (error) {
    console.error('Error handling deposit action:', error.message);
    await ctx.replyWithHTML('⚠️ An error occurred while processing the deposit action. Please try again.');
  }
});

bot.action('play', async (ctx) => {
  try {
    await playCommand(bot, ctx);
  } catch (error) {
    console.error('Error handling play action:', error.message);
    await ctx.replyWithHTML('⚠️ An error occurred while processing the play action. Please try again.');
  }
});

bot.action('balance', async (ctx) => {
  try {
    await balanceCommand(bot, ctx);
  } catch (error) {
    console.error('Error handling balance action:', error.message);
    await ctx.replyWithHTML('⚠️ An error occurred while processing the balance action. Please try again.');
  }
});

bot.action('withdrawal', async (ctx) => {
  try {
    await withdrawalCommand(bot, ctx);
  } catch (error) {
    console.error('Error handling withdrawal action:', error.message);
    await ctx.replyWithHTML('⚠️ An error occurred while processing the withdrawal action. Please try again.');
  }
});

bot.action('referral', async (ctx) => {
  try {
    await referralCommand(bot, ctx);
  } catch (error) {
    console.error('Error handling referral action:', error.message);
    await ctx.replyWithHTML('⚠️ An error occurred while processing the referral action. Please try again.');
  }
});

bot.action('admin', async (ctx) => {
  try {
    await adminCommand(bot, ctx);
  } catch (error) {
    console.error('Error handling admin action:', error.message);
    await ctx.replyWithHTML('⚠️ An error occurred while processing the admin action. Please try again.');
  }
});

// Handle unrecognized commands or general text
bot.on('text', async (ctx) => {
  await ctx.replyWithHTML(
    '❌ <b>Unknown command or input.</b>\nUse <code>/menu</code> to see available options.'
  );
});

// Global error handler (optional but recommended)
bot.catch(async (err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}:`, err.message);
  await ctx.replyWithHTML(
    '❌ <b>An unexpected error occurred.</b>\nPlease try again later.'
  );
});

// Export the bot instance
module.exports = bot;
