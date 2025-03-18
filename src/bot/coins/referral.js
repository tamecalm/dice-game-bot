import { Markup } from 'telegraf'; // ES6 import
import User from '../../models/User.js'; // ES6 import

const REFERRAL_PERCENTAGE = 20; // Reward percentage for referrals
const MIN_DEPOSIT = 500; // Minimum deposit to qualify for rewards

export function setupReferral(bot) {
  // Handle referral info display
  bot.action('referral', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      // Fetch user
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithMarkdown('❌ **You are not registered.**\nUse /start to register.');
      }

      // Generate referral code if not present
      if (!user.referralCode) {
        user.referralCode = `${telegramId}-${Date.now().toString(36)}`;
        await user.save();
      }

      // Count successful referrals
      const totalReferrals = await User.countDocuments({ referredBy: user.referralCode });

      // Build referral link
      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${user.referralCode}`;

      // Send referral info
      await ctx.replyWithMarkdown(
        `🎉 **Your Referral Stats**\n\n` +
          `🔗 **Referral Link:** [Click Here](${referralLink})\n` +
          `🏷️ **Referral Code:** \`${user.referralCode}\`\n` +
          `👥 **Total Referrals:** ${totalReferrals}\n` +
          `💰 **Earnings:** ${user.referralEarnings.toFixed(2)} ${user.currency}\n\n` +
          `✨ Invite friends and earn **${REFERRAL_PERCENTAGE}%** of their first deposit (min. ${MIN_DEPOSIT} ${user.currency}).\n` +
          `*Rewards are credited after their deposit.*`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'clear')]])
      );
    } catch (error) {
      console.error('Error in referral handler:', error.message);
      return ctx.reply('⚠️ Something went wrong. Please try again later.');
    }
  });

  // Handle referral logic for new users (called from start.js)
  bot.on('text', async (ctx, next) => {
    const telegramId = ctx.from.id;
    const referralCode = ctx.message.text.split(' ')[1]; // Extract referral code from /start

    if (!ctx.message.text.startsWith('/start') || !referralCode) {
      return next(); // Skip if not a referral start
    }

    const user = await User.findOne({ telegramId });
    if (user || !referralCode) return next(); // Let start.js handle existing users or no referral

    // Create new user with referral
    const newUser = new User({
      telegramId,
      username: ctx.from.username || 'Anonymous',
      referredBy: referralCode,
      referralCode: null, // Will be set later when they view referrals
      balance: 0,
      currency: 'NGN',
      totalDeposits: 0,
      gamesPlayed: 0,
      country: null,
      state: null,
      tempAmount: null,
      usdtAddress: null,
      referralEarnings: 0,
      lastLogin: new Date(),
      firstDeposit: null,
    });
    await newUser.save();

    // Notify referrer
    const referrer = await User.findOne({ referralCode });
    if (referrer) {
      await bot.telegram.sendMessage(
        referrer.telegramId,
        `🎉 **New Referral!**\n\n` +
          `👤 **${ctx.from.username || 'Someone'}** joined with your link!`,
        { parse_mode: 'Markdown' }
      );
    }

    return next(); // Pass to start.js for welcome message
  });
}