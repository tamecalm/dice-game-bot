const User = require('../../models/User');
const { Markup } = require('telegraf');

module.exports = (bot) => {
  // Inline button handler for "Referral"
  bot.action('referral', async (ctx) => {
    try {
      // Acknowledge the button click
      await ctx.answerCbQuery();

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

      // Send the referral details
      await ctx.replyWithHTML(
        `🎉 <b>Your Referral Code:</b> <code>${user.referralCode}</code>\n` +
          `📲 <b>Referral Link:</b> <a href="${referralLink}">${referralLink}</a>\n` +
          `\n💰 Invite your friends and earn rewards when they join!`,
        Markup.inlineKeyboard([
          [Markup.button.url('🔗 Share Referral Link', referralLink)],
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
      );
    } catch (error) {
      console.error('Error in referral button handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Command handler for "/referral"
  bot.command('referral', async (ctx) => {
    try {
      const telegramId = ctx.from.id;

      // Find the user in the database
      let user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Generate a referral code if the user doesn't already have one
      if (!user.referralCode) {
        user.referralCode = `${telegramId}`; // Generate unique referral code
        await user.save();
      }

      // Generate the referral link
      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${user.referralCode}`;

      // Send the referral details
      await ctx.replyWithHTML(
        `🎉 <b>Your Referral Code:</b> <code>${user.referralCode}</code>\n` +
          `📲 <b>Referral Link:</b> <a href="${referralLink}">${referralLink}</a>\n` +
          `\n💰 Invite your friends and earn rewards when they join!`,
        Markup.inlineKeyboard([
          [Markup.button.url('🔗 Share Referral Link', referralLink)],
          [Markup.button.callback('⬅️ Back to Menu', 'start')],
        ])
      );
    } catch (error) {
      console.error('Error in referral command:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

// Inline button handler for "Back to Menu"
bot.action('menu', async (ctx) => {
  try {
    // Acknowledge the button click
    await ctx.answerCbQuery();

    // Display the main menu
    await ctx.reply(
      `⬅️ Back to the main menu! Choose an option:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🎮 Play', 'play'), Markup.button.callback('💰 Deposit', 'deposit')],
        [Markup.button.callback('📊 Balance', 'balance'), Markup.button.callback('🏦 Withdrawal', 'withdrawal')],
        [Markup.button.callback('👥 Referral', 'referral')],
      ])
    );
  } catch (error) {
    console.error('Error in back to menu handler:', error.message);
    ctx.reply('❌ An unexpected error occurred. Please try again later.');
  }
});
