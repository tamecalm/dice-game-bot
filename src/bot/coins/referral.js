// ==========================================================================
// Dice Game Bot Project - Script Header
// ==========================================================================
//
// Project: Dice Game Bot
// Repository: https://github.com/tamecalm/dice-game-bot
// 
// Description: 
// A robust and extensible module designed for a multiplayer dice game bot. 
// Feel free to use, modify, or contribute to the project under the terms of the repository's license.
//
// Author: Engr John! 🧑‍💻
// Year: 2024
// 
// License: Licensed under the terms of the repository's license. Unauthorized duplication, 
// Modification, or distribution of this script outside the license terms is prohibited.
// ==========================================================================

import { Markup } from 'telegraf'; // ES6 import
import User from '../../models/User.js'; // ES6 import
import settings from '../../config/settings.js'; // ES6 import

const REFERRAL_PERCENTAGE = 20; // Reward percentage for referrals
const MIN_DEPOSIT = 500; // Minimum deposit to qualify for rewards

export default (bot) => {
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

  // Handle deposit and reward logic
  bot.command('deposit', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const depositAmount = parseFloat(ctx.message.text.split(' ')[1]);

      if (isNaN(depositAmount) || depositAmount <= 0) {
        return ctx.replyWithMarkdown('❌ **Invalid Amount**\nPlease enter a valid deposit (e.g., /deposit 1000).');
      }

      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to register.');
      }

      // Simulate deposit (replace with actual payment integration)
      user.balance += depositAmount;
      user.totalDeposits += depositAmount;
      if (!user.firstDeposit) user.firstDeposit = new Date();
      await user.save();

      // Handle referral reward
      if (user.referredBy && !user.firstDeposit && depositAmount >= MIN_DEPOSIT) {
        const referrer = await User.findOne({ referralCode: user.referredBy });
        if (referrer) {
          const reward = (depositAmount * REFERRAL_PERCENTAGE) / 100;
          referrer.referralEarnings += reward;
          referrer.balance += reward;
          await referrer.save();

          await bot.telegram.sendMessage(
            referrer.telegramId,
            `💰 **Referral Bonus!**\n\n` +
              `🎉 You earned ${reward.toFixed(2)} ${user.currency} from **${ctx.from.username || 'your referral'}**’s deposit of ${depositAmount} ${user.currency}!`,
            { parse_mode: 'Markdown' }
          );
        }
      }

      return ctx.replyWithMarkdown(
        `✅ **Deposit Successful!**\n\n` +
          `💳 **Amount:** ${depositAmount.toFixed(2)} ${user.currency}\n` +
          `💰 **New Balance:** ${user.balance.toFixed(2)} ${user.currency}`
      );
    } catch (error) {
      console.error('Error in deposit command:', error.message);
      return ctx.reply('⚠️ Something went wrong. Please try again later.');
    }
  });
};

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
