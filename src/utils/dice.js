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

// module.exports = () => Math.floor(Math.random() * 6) + 1;
// This is not available again since the dice logic will be called in the same script where the 2 player mode setup is available

// All thanks to Calm for bringing up the idea to develop soemthing like this.
/*
const playCommand = (bot) => {
  bot.action('play', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      const betAmounts = [100, 500, 1000, 1500, 2000, 3000];

      const inlineKeyboard = [
        betAmounts.slice(0, 3).map((amount) => ({ text: `₦${amount}`, callback_data: `bet_${amount}` })),
        betAmounts.slice(3).map((amount) => ({ text: `₦${amount}`, callback_data: `bet_${amount}` })),
      ];

      const betMessage = await ctx.reply('💵 Please select the amount you want to bet:', {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });

      setTimeout(async () => {
        try {
          await ctx.deleteMessage(betMessage.message_id);
        } catch (error) {
          logError('deleteBetMessage', error);
        }
      }, 30000);
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  */

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
