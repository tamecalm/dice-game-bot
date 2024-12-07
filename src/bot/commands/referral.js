const User = require('../../models/User');

module.exports = (bot) => {
  bot.command('👥 Referral', async (ctx) => {
    try {
      if (!ctx || !ctx.from) {
        console.error('Invalid context object:', ctx);
        return ctx.reply('An error occurred. Please try again later.');
      }

      const telegramId = ctx.from.id;

      let user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Check if user already has a referral code
      if (!user.referralCode) {
        user.referralCode = `REF-${telegramId}`; // Generate unique referral code
        await user.save();
      }

      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${user.referralCode}`;
      return ctx.replyWithHTML(
        `🎉 <b>Your Referral Code:</b> <code>${user.referralCode}</code>\n` +
          `📲 <b>Referral Link:</b> <a href="${referralLink}">${referralLink}</a>\n` +
          `💰 Invite your friends and earn rewards when they join!`
      );
    } catch (error) {
      console.error('Error in referral command:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
