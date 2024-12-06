const User = require('../../models/User');

module.exports = async (ctx) => {
  try {
    // Validate the context object
    if (!ctx || typeof ctx.reply !== 'function') {
      console.error('Invalid context object received in start.js.');
      return;
    }

    // Validate ctx.from and extract Telegram user details
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || 'Anonymous';

    if (!telegramId) {
      await ctx.reply('Could not identify your Telegram ID. Please try again.');
      console.error('Missing Telegram ID in context.');
      return;
    }

    // Find the user in the database or create a new one
    let user = await User.findOne({ telegramId });
    if (!user) {
      user = new User({ telegramId, username });
      await user.save();
      console.log(`New user registered: ${username} (ID: ${telegramId})`);
      await ctx.reply('Welcome! You have been successfully registered.');
    } else {
      console.log(`Returning user: ${username} (ID: ${telegramId})`);
      await ctx.reply('Welcome back!');
    }

    // Provide further instructions
    await ctx.reply('Use /deposit to add funds, /play to find a match, and /balance to check your balance.');
  } catch (error) {
    console.error('Error in start command:', error.message);

    // Send an error message to the user if possible
    if (ctx && typeof ctx.reply === 'function') {
      await ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }
};
