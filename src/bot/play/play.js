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

// bot/commands/play.js
// play.js
import { Markup } from 'telegraf'; // ES6 import

async function setupPlay(bot) {
  // Handle /play command to show mode selection
  bot.command('play', async (ctx) => {
    try {
      await ctx.replyWithMarkdown(
        `🎲 **Choose Your Game Mode**\n\n` +
          `Pick how you’d like to play:`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback('🤖 Vs Computer', 'play_pvc'),
                Markup.button.callback('👥 Vs Player', 'play_pvp'),
              ],
            ],
          },
        }
      );
    } catch (error) {
      console.error('Error in /play command:', error.message);
      await ctx.reply('⚠️ Something went wrong. Try again later.');
    }
  });

  // Delegate to PvC mode
  bot.action('play_pvc', async (ctx) => {
    await ctx.answerCbQuery();
    const pvcHandler = (await import('../gameModes/playPvC.js')).default;
    pvcHandler(ctx); // Call PvC handler directly
  });

  // Delegate to PvP mode
  bot.action('play_pvp', async (ctx) => {
    await ctx.answerCbQuery();
    const pvpHandler = (await import('../gameModes/playPvP.js')).default;
    pvpHandler(ctx); // Call PvP handler directly
  });
}

export default setupPlay;

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
