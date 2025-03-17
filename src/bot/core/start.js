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

import { Markup } from 'telegraf'; // ES6 import (assumes you're using a module system)
import User from '../../models/User.js'; // Adjusted to ES6 import with .js extension

export default (bot) => {
  bot.command('start', async (ctx) => {
    try {
      // Validate context
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

      // Find or create user
      let user = await User.findOne({ telegramId });
      let welcomeMessage;

      if (!user) {
        // Initialize new user with all schema fields
        user = new User({
          telegramId,
          username,
          balance: 0,
          currency: 'NGN',
          totalDeposits: 0,
          gamesPlayed: 0,
          country: null, // Will be set later if you add logic for it
          referralCode: null, // Generate this if you have a function for it
          referredBy: null,
          state: null,
          tempAmount: null,
          usdtAddress: null,
          referralEarnings: 0,
          lastLogin: new Date(), // Set on creation
          firstDeposit: null,
        });
        await user.save();
        console.log(`New user registered: ${username} (ID: ${telegramId})`);

        welcomeMessage = `
🎲 **Welcome to Bet The Dice!** 🎲

Hello **${username}**! You're now part of the game.  
Roll the dice, place your bets, and win big!  

✨ **What’s Next?**  
- Deposit funds to start playing  
- Invite friends to earn rewards  
- Check your balance anytime  

Ready to dive in? Use the menu below to get started!
        `;
      } else {
        // Update lastLogin for returning user
        user.lastLogin = new Date();
        await user.save();
        console.log(`Returning user: ${username} (ID: ${telegramId})`);

        welcomeMessage = `
🎲 **Welcome Back to Bet The Dice!** 🎲

Hey **${username}**! Great to see you again.  
Your next big win is just a roll away!  

💰 **Balance:** ${user.balance} ${user.currency}  
🎮 **Games Played:** ${user.gamesPlayed}  

Pick an option below and let’s roll!
        `;
      }

      // Single "Close" button with 'clear' callback
      const inlineButtons = Markup.inlineKeyboard([
        [Markup.button.callback('✖️ Close', 'clear')],
      ]);

      // Send welcome message with improved UI
      await ctx.replyWithMarkdown(welcomeMessage, inlineButtons);
    } catch (error) {
      console.error('Error in start command:', error.message);
      if (ctx && typeof ctx.reply === 'function') {
        await ctx.reply('⚠️ Oops! Something went wrong. Try again later.');
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
