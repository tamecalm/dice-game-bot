const User = require('../../models/User');

module.exports = (bot) => {
  // Inline button handler for "Referral"
  bot.action('referral', async (ctx) => {
    try {
      // Acknowledge the button click
      await ctx.answerCbQuery(); // Sends a callback response to the user
      // Redirect to the referral command logic
      return bot.handleUpdate({
        message: {
          ...ctx.update.callback_query.message,
          text: '/👥 Referral',
        },
      });
    } catch (error) {
      console.error('Error in referral button handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Command handler for "/👥 Referral"
  bot.command('👥 Referral', async (ctx) => {
    try {
      if (!ctx || !ctx.from) {
        console.error('Invalid context object:', ctx);
        return ctx.reply('An error occurred. Please try again later.');
      }

      const telegramId = ctx.from.id;

      // Find the user in the database
      let user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Generate a referral code if the user doesn't already have one
      if (!user.referralCode) {
        user.referralCode = `REF-${telegramId}`; // Generate unique referral code
        await user.save();
      }

      // Generate the referral link
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
