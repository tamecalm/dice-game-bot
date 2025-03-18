// src/bot/core/start.js
import { Markup } from 'telegraf';
import User from '../../models/User.js';

/**
 * Handles the /start command for Bet The Dice bot.
 * @param {Object} ctx - Telegram bot context.
 */
async function start(ctx) {
  try {
    console.log(`📩 /start command received from: ${ctx.from?.id} (${ctx.from?.username})`);

    if (!ctx || typeof ctx.reply !== 'function') {
      console.error('❌ Invalid context object received.');
      return;
    }

    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || 'Anonymous';

    if (!telegramId) {
      console.error('❌ Missing Telegram ID.');
      await ctx.reply('🚨 Could not identify your Telegram ID. Please try again.');
      return;
    }

    console.log(`🔍 Checking if user exists: ${telegramId}`);
    let user = await User.findOne({ telegramId });

    let welcomeMessage;
    if (!user) {
      console.log(`🆕 New user detected: ${username} (ID: ${telegramId})`);
      user = new User({
        telegramId,
        username,
        balance: 0,
        currency: 'NGN',
        totalDeposits: 0,
        gamesPlayed: 0,
        country: null,
        referralCode: null,
        referredBy: null,
        state: null,
        tempAmount: null,
        usdtAddress: null,
        referralEarnings: 0,
        lastLogin: new Date(),
        firstDeposit: null,
      });
      await user.save();
      console.log('✅ New user registered successfully.');

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
      console.log(`👋 Returning user: ${username} (ID: ${telegramId})`);
      user.lastLogin = new Date();
      await user.save();

      welcomeMessage = `
🎲 **Welcome Back to Bet The Dice!** 🎲

Hey **${username}**! Great to see you again.  
Your next big win is just a roll away!  

💰 **Balance:** ${user.balance} ${user.currency}  
🎮 **Games Played:** ${user.gamesPlayed}  

Pick an option below and let’s roll!
      `;
    }

    const inlineButtons = Markup.inlineKeyboard([
      [Markup.button.callback('✖️ Close', 'clear')],
    ]);

    await ctx.replyWithMarkdown(welcomeMessage, inlineButtons);
    console.log(`✅ Sent welcome message to ${telegramId}`);
  } catch (error) {
    console.error('❌ Error in /start command:', error);
    if (ctx && typeof ctx.reply === 'function') {
      await ctx.reply('⚠️ Oops! Something went wrong. Try again later.');
    }
  }
}

// Setup function
export const setupStart = (bot) => {
  bot.command('start', start);
};

export default setupStart;