const User = require('../../models/User');

module.exports = async (ctx) => {
  try {
    if (!ctx || !ctx.from) {
      console.error('Invalid or undefined ctx.from:', ctx);
      return ctx.reply
        ? ctx.reply('An error occurred. Please try again later.')
        : console.error('ctx.reply is not available');
    }

    const telegramId = ctx.from.id;

    const user = await User.findOne({ telegramId });
    if (!user) {
      return ctx.reply('You are not registered. Use /start to register.');
    }

    return ctx.reply(`💰 Your balance: ${user.balance.toFixed(2)} ${user.currency}`);
  } catch (error) {
    console.error('Error in balance command:', error.message);
    if (ctx && typeof ctx.reply === 'function') {
      ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }
};
