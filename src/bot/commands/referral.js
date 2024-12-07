const { Markup } = require('telegraf');
const User = require('../../models/User');
const settings = require('../../config/settings'); // Assuming settings.js holds referral reward percentages

module.exports = (bot) => {
  const REFERRAL_PERCENTAGE = 20; // Reward percentage for referrals (20% of the first deposit)
  const MIN_DEPOSIT = 500; // Minimum deposit to qualify for rewards

  // Inline button handler for referral system
  bot.action('referral', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      let user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      // Ensure the user has a unique referral code
      if (!user.referralCode) {
        user.referralCode = `${telegramId}-${Date.now().toString(36)}`;
        await user.save();
      }

      // Fetch total number of successful referrals
      const totalReferrals = await User.countDocuments({ referredBy: user.referralCode });

      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${user.referralCode}`;
      await ctx.replyWithHTML(
        `🎉 <b>Your Referral Information</b>\n\n` +
          `🔗 <b>Referral Link:</b> <a href="${referralLink}">${referralLink}</a>\n` +
          `🏷️ <b>Referral Code:</b> <code>${user.referralCode}</code>\n` +
          `👥 <b>Total Referrals:</b> ${totalReferrals}\n\n` +
          `💰 Invite friends and earn <b>${REFERRAL_PERCENTAGE}%</b> of their first deposit (minimum ${MIN_DEPOSIT} ${settings.defaultCurrency}).\n` +
          `<i>Rewards are credited only after the referral’s deposit.</i>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
      );
    } catch (error) {
      console.error('Error in referral command:', error.message);
      await ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle new user registration with referral link
  bot.command('start', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const referralCode = ctx.message.text.split(' ')[1]; // Extract referral code, if provided

      let user = await User.findOne({ telegramId });
      if (!user) {
        user = new User({ telegramId, referredBy: referralCode });
        await user.save();

        // Notify the referrer
        if (referralCode) {
          const referrer = await User.findOne({ referralCode });
          if (referrer) {
            await bot.telegram.sendMessage(
              referrer.telegramId,
              `🎉 <b>New Referral!</b>\n\n` +
                `👤 <b>${ctx.from.first_name || 'Someone'}</b> joined using your referral link!`,
              { parse_mode: 'HTML' }
            );
          }
        }
      }

      return ctx.replyWithHTML(
        `🎉 Welcome, <b>${ctx.from.first_name || 'User'}</b>!\n\nUse /menu to explore the options.`
      );
    } catch (error) {
      console.error('Error in /start command:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle deposits to reward referrers
  bot.command('deposit', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const depositAmount = parseFloat(ctx.message.text.split(' ')[1]); // Parse deposit amount

      if (isNaN(depositAmount) || depositAmount <= 0) {
        return ctx.reply('❌ Please enter a valid deposit amount.');
      }

      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      // Update the user's balance
      user.balance += depositAmount;
      await user.save();

      // Check if this is the first qualifying deposit for referral reward
      if (user.referredBy && !user.referralRewarded && depositAmount >= MIN_DEPOSIT) {
        const referrer = await User.findOne({ referralCode: user.referredBy });

        if (referrer) {
          const reward = (depositAmount * REFERRAL_PERCENTAGE) / 100;
          referrer.balance += reward; // Credit reward to referrer
          await referrer.save();

          user.referralRewarded = true; // Mark the reward as given
          await user.save();

          // Notify the referrer
          await bot.telegram.sendMessage(
            referrer.telegramId,
            `💰 <b>Referral Reward Credited!</b>\n\n` +
              `🎉 You earned ${reward.toFixed(2)} ${settings.defaultCurrency} for ${ctx.from.first_name || 'your referral'}'s first deposit of ${depositAmount} ${settings.defaultCurrency}!`,
            { parse_mode: 'HTML' }
          );
        }
      }

      return ctx.replyWithHTML(
        `✅ <b>Deposit Successful!</b>\n\n💳 <b>Amount:</b> ${depositAmount.toFixed(2)} ${settings.defaultCurrency}\n💰 <b>New Balance:</b> ${user.balance.toFixed(2)} ${settings.defaultCurrency}`
      );
    } catch (error) {
      console.error('Error in deposit command:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
