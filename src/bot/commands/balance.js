// Balance Logics

const User = require('../../models/User');

module.exports = async (ctx) => {
  const telegramId = ctx.from.id;
  const user = await User.findOne({ telegramId });

  if (!user) {
    return ctx.reply('You are not registered. Use /start to register.');
  }

  return ctx.reply(`💰 Your balance: ${user.balance.toFixed(2)} ${user.currency}`);
};