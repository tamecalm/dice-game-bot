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

import { Markup, Telegraf } from 'telegraf'; // ES6 import
import settings from '../../config/settings.js'; // ES6 import

// Import command handlers
import startCommand from './start.js';
import balanceCommand from '../coins/balance.js';
import depositCommand from './deposit.js';
import playCommand from './play.js';
import adminCommand from '../owner/admin.js';
import withdrawalCommand from './withdrawal.js';
import referralCommand from './referral.js';

// Initialize the bot
const bot = new Telegraf(settings.botToken);

// Register command handlers
startCommand(bot);
balanceCommand(bot);
depositCommand(bot);
playCommand(bot);
withdrawalCommand(bot);
referralCommand(bot);
adminCommand(bot);

// Clear action handler (for middleware compatibility)
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
  ctx.replyWithMarkdown(
    '❌ **Unknown Command**\nUse the menu below or type /start to begin.'
  );
});

// Global error handler
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}:`, err.message);
  ctx.replyWithMarkdown('⚠️ **Oops!** An error occurred. Please try again.');
});

// Export the bot instance
export default bot;

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
