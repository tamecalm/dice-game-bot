const User = require('../../models/User');

module.exports = async (ctx) => {
  if (!ctx || typeof ctx.reply !== 'function') {
    console.error('Invalid context object received.');
    return;
  }

  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username || 'Anonymous';

    if (!telegramId) {
      return ctx.reply('Could not identify your Telegram ID. Please try again.');
    }

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
    if (ctx && typeof ctx.reply === 'function') {
      ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }
};
