const { Markup } = require('telegraf');
const User = require('../../models/User');

module.exports = async (ctx) => {
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
    let keyboard;

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

      keyboard = Markup.keyboard([
        ['💰 Deposit', '🎮 Play'],
        ['📊 Balance', '🏦 Withdrawal'],
        ['👥 Referral'],
      ])
        .resize()
        .oneTime(false);
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

      keyboard = Markup.keyboard([
        ['🎮 Play', '💰 Deposit'],
        ['📊 Balance', '🏦 Withdrawal'],
        ['👥 Referral'],
      ])
        .resize()
        .oneTime(false);
    }

    // Send the welcome message with keyboard buttons
    await ctx.replyWithMarkdown(welcomeMessage, keyboard);
  } catch (error) {
    console.error('Error in start command:', error.message);

    // Send an error message to the user if possible
    if (ctx && typeof ctx.reply === 'function') {
      await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
    }
  }
};
