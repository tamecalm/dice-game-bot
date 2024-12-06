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
    let buttons;

    if (!user) {
      user = new User({ telegramId, username });
      await user.save();
      console.log(`New user registered: ${username} (ID: ${telegramId})`);

      welcomeMessage = `
🎲 **Welcome to Bet The Dice!** 🎲

👋 Hi, **${username}**, you've been successfully registered. 

Here's what you can do:
💰 **/deposit** - Add funds to your account  
🎮 **/play** - Find an opponent to start betting  
📊 **/balance** - Check your account balance  
👥 **/referral** - Invite friends and earn rewards  
🏦 **/withdrawal** - Withdraw your winnings`;

      buttons = Markup.inlineKeyboard([
        [Markup.button.callback('💰 Deposit', 'deposit')],
        [Markup.button.callback('🎮 Play Now', 'play')],
        [Markup.button.callback('📊 Check Balance', 'balance')],
        [Markup.button.callback('🏦 Withdraw Funds', 'withdrawal')],
        [Markup.button.callback('👥 Referral', 'referral')],
      ]);
    } else {
      console.log(`Returning user: ${username} (ID: ${telegramId})`);

      welcomeMessage = `
🎲 **Welcome Back to Bet The Dice!** 🎲

👋 Hello again, **${username}**!  
Ready to continue betting and winning? Here's what you can do:
💰 **/deposit** - Add more funds to your account  
🎮 **/play** - Find an opponent to roll the dice  
📊 **/balance** - View your current balance  
👥 **/referral** - Earn rewards by inviting friends  
🏦 **/withdrawal** - Withdraw your winnings`;

      buttons = Markup.inlineKeyboard([
        [Markup.button.callback('🎮 Play Now', 'play')],
        [Markup.button.callback('💰 Deposit Funds', 'deposit')],
        [Markup.button.callback('📊 View Balance', 'balance')],
        [Markup.button.callback('🏦 Withdraw Funds', 'withdrawal')],
      ]);
    }

    // Send the welcome message with inline buttons
    await ctx.replyWithMarkdown(welcomeMessage, buttons);

    // Follow-up with a motivational note
    await ctx.replyWithMarkdown(
      `✨ *Pro Tip*: Invite friends using your referral link to boost your balance and get milestone bonuses! 🎉`
    );
  } catch (error) {
    console.error('Error in start command:', error.message);

    // Send an error message to the user if possible
    if (ctx && typeof ctx.reply === 'function') {
      await ctx.reply('⚠️ An unexpected error occurred. Please try again later.');
    }
  }
};
