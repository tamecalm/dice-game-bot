// Start Logics

const User = require('../../models/User');

module.exports = async (ctx) => {
  try {
    // Check if ctx.from exists to avoid crashes
    if (!ctx.from) {
      return ctx.reply('An error occurred. Please try again.');
    }

    const telegramId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';

    let user = await User.findOne({ telegramId });
    if (!user) {
      user = new User({ telegramId, username });
      await user.save();
      await ctx.reply('Welcome! You have been registered.');
    } else {
      await ctx.reply('Welcome back!');
    }

    await ctx.reply('Use /deposit to add funds, /play to find a match, and /balance to check your balance.');
  } catch (error) {
    console.error('Error in start command:', error.message);
    ctx.reply('An unexpected error occurred. Please try again later.');
  }
};
