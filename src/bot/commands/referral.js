const { Markup } = require('telegraf');  // Import Markup from telegraf
const User = require('../../models/User');

module.exports = (bot) => {
  bot.action('referral', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      let user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (!user.referralCode) {
        user.referralCode = `REF-${telegramId}`;
        await user.save();
      }

      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${user.referralCode}`;
      await ctx.replyWithHTML(
        `🎉 <b>Your Referral Code:</b> <code>${user.referralCode}</code>\n` +
        `📲 <b>Referral Link:</b> <a href="${referralLink}">${referralLink}</a>\n` +
        `💰 Invite your friends and earn rewards when they join!`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
      );
    } catch (error) {
      console.error('Error in referral command:', error.message);
      await ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
