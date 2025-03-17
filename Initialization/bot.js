// bot.js
import { Telegraf } from 'telegraf'; // ES6 import
import settings from '../src/config/settings.js'; // ES6 import

// Import command handlers
import startCommand from '../src/bot/core/start.js';
import balanceCommand from '../src/bot/coins/balance.js';
import depositCommand from '../src/bot/coins/deposit.js';
import setupPlay from '../src/bot/play/play.js';
import adminCommand from '../src/bot/owner/admin.js';
import withdrawalCommand from '../src/bot/coins/withdrawal.js';
import referralCommand from '../src/bot/coins/referral.js';

// Initialize the bot
const bot = new Telegraf(settings.botToken);

// Register command handlers with logging
const registerHandler = (name, handler) => {
  handler(bot);
  console.log(`✅ Registered handler: ${name}`);
};

registerHandler('start', startCommand);
registerHandler('balance', balanceCommand);
registerHandler('deposit', depositCommand);
registerHandler('play', setupPlay);
registerHandler('withdrawal', withdrawalCommand);
registerHandler('referral', referralCommand);
registerHandler('admin', adminCommand);

// Clear action handler
bot.action('clear', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Error in clear handler:', error.message);
  }
});

// Handle unrecognized text input
bot.on('text', (ctx) => {
  console.log(`Received text from ${ctx.from.id}: ${ctx.message.text}`);
  ctx.replyWithMarkdown(
    '❌ **Unknown Command**\nUse the menu below or type /start to begin.'
  );
});

// Global error handler
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}:`, err.message);
  ctx.replyWithMarkdown('⚠️ **Oops!** An error occurred. Please try again.');
});

export default bot;