// Start Logics

const User = require('../../models/User');

module.exports = async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || 'Anonymous';

  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({ telegramId, username });
    await user.save();
    ctx.reply(' Welcome! You have been registered.');
  } else {
    ctx.reply('Welcome back!');
  }

  ctx.reply('Use /deposit to add funds, /play to find a match, and /balance to check your balance.');
};