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
const User = require('../../models/User');
const settings = require('../../config/settings'); // Import admin ID settings

module.exports = (bot) => {
  bot.command('start', async (ctx) => {
    try {
      // Validate the context object
      if (!ctx || typeof ctx.reply !== 'function') {
        console.error('Invalid context object received in start.js.');
        return;
      }

      // Extract Telegram user details
      const telegramId = ctx.from?.id;
      const username = ctx.from?.username || 'Anonymous';

      if (!telegramId) {
        await ctx.reply('🚨 Could not identify your Telegram ID. Please try again.');
        console.error('Missing Telegram ID in context.');
        return;
      }

      // Find the user in the database or create a new one
      let user = await User.findOne({ telegramId });
      let welcomeMessage;
      let inlineButtonsArray;

      if (!user) {
        user = new User({ telegramId, username });
        await user.save();
        console.log(`New user registered: ${username} (ID: ${telegramId})`);

        welcomeMessage = `
🎲 **Welcome to Bet The Dice!** 🎲

👋 Hi, **${username}**, you've been successfully registered.  

Here's what you can do:
💰 **Deposit Funds**  
🎮 **Play and Bet**  
📊 **Check Your Balance**  
👥 **Refer Friends**  
🏦 **Withdraw Your Winnings**`;

        inlineButtonsArray = [
          [Markup.button.callback('💰 Deposit', 'deposit'), Markup.button.callback('🎮 Play', 'play')],
          [Markup.button.callback('📊 Balance', 'balance'), Markup.button.callback('🏦 Withdrawal', 'withdrawal')],
          [Markup.button.callback('👥 Referral', 'referral')],
        ];
      } else {
        console.log(`Returning user: ${username} (ID: ${telegramId})`);

        welcomeMessage = `
🎲 **Welcome Back to Bet The Dice!** 🎲

👋 Hello again, **${username}**!  
Ready to roll the dice and win big? Here's what you can do:
💰 **Deposit More Funds**  
🎮 **Find an Opponent and Play**  
📊 **View Your Current Balance**  
👥 **Refer Friends for Rewards**  
🏦 **Withdraw Your Winnings**`;

        inlineButtonsArray = [
          [Markup.button.callback('🎮 Play', 'play'), Markup.button.callback('💰 Deposit', 'deposit')],
          [Markup.button.callback('📊 Balance', 'balance'), Markup.button.callback('🏦 Withdrawal', 'withdrawal')],
          [Markup.button.callback('👥 Referral', 'referral')],
        ];
      }

      // Add admin options if the user is an admin
      if (settings.adminIds.includes(telegramId)) {
        welcomeMessage += `

🛠 **Admin Panel**  
Manage and monitor your bot with admin tools.`;

        // Append the admin button to the inline buttons array
        inlineButtonsArray.push([Markup.button.callback('🛠 Admin Panel', 'admin')]);
      }

      // Create the keyboard with the updated buttons array
      const inlineButtons = Markup.inlineKeyboard(inlineButtonsArray);

      // Send the welcome message with inline buttons
      await ctx.replyWithMarkdown(welcomeMessage, inlineButtons);
    } catch (error) {
      console.error('Error in start command:', error.message);

      // Send an error message to the user if possible
      if (ctx && typeof ctx.reply === 'function') {
        await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
      }
    }
  });
};


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
