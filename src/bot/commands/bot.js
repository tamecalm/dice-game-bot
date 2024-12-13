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

const { Markup } = require('telegraf');
const { Telegraf } = require('telegraf'); // Saved for later
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
startCommand(bot);     // Registers /start and related actions
balanceCommand(bot);   // Registers /balance and related actions
depositCommand(bot);   // Registers /deposit and related actions
playCommand(bot);      // Registers /play and related actions
withdrawalCommand(bot); // Registers /withdrawal and related actions
referralCommand(bot);  // Registers /referral and related actions
adminCommand(bot);     // Registers /admin and related actions

// Inline button handlers
bot.action('deposit', (ctx) => depositCommand(bot, ctx));
bot.action('play', (ctx) => playCommand(bot, ctx));
bot.action('balance', (ctx) => balanceCommand(bot, ctx));
bot.action('withdrawal', (ctx) => withdrawalCommand(bot, ctx));
bot.action('referral', (ctx) => referralCommand(bot, ctx));

// Back to menu handler
bot.action('menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    // Edit the current message with the new content and buttons
    await ctx.editMessageText(
      `👋 Welcome back, ${ctx.from.first_name}!\n\n` + // Personalized greeting
      `You have returned to the main menu. Choose what you'd like to do next!` + // Encouraging text
      `\n\n` +
      `Explore the options below and make your choice:`, // Additional stylistic choice 
      Markup.inlineKeyboard([  // Inline keyboard with options
        [Markup.button.callback('🎮 Play', 'play'), Markup.button.callback('💰 Deposit', 'deposit')],
        [Markup.button.callback('📊 Balance', 'balance'), Markup.button.callback('🏦 Withdrawal', 'withdrawal')],
        [Markup.button.callback('👥 Referral', 'referral')] // Added 'referral' action here
      ])
    );
  } catch (error) {
    console.error('Error in back to menu handler:', error.message);
    ctx.reply('❌ An unexpected error occurred. Please try again later.');
  }
});

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


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
