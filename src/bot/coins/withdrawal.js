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
import User from '../../models/User.js'; // Adjusted to ES6 import
import Flutterwave from 'flutterwave-node-v3'; // ES6 import
import settings from '../../config/settings.js'; // ES6 import

const DAILY_WITHDRAWAL_LIMIT = 200; // Default withdrawal amount
const VAT_PERCENTAGE = 10; // VAT fee percentage

// Initialize Flutterwave SDK
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY || settings.flutterwavePublicKey,
  process.env.FLW_SECRET_KEY || settings.flutterwaveSecretKey
);

export default (bot) => {
  // Handle withdrawal initiation
  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      // Fetch user
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithMarkdown(
          '❌ **You are not registered.**\nUse /start to register.'
        );
      }

      // Check balance
      if (user.balance < DAILY_WITHDRAWAL_LIMIT) {
        return ctx.replyWithMarkdown(
          `❌ **Insufficient Balance**\n` +
            `Your balance: ${user.balance.toFixed(2)} ${user.currency}\n` +
            `Minimum withdrawal: ${DAILY_WITHDRAWAL_LIMIT} ${user.currency}`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'clear')]])
        );
      }

      // Calculate withdrawal details
      const vatFee = (DAILY_WITHDRAWAL_LIMIT * VAT_PERCENTAGE) / 100;
      const finalAmount = DAILY_WITHDRAWAL_LIMIT - vatFee;

      // Show confirmation prompt
      return ctx.replyWithMarkdown(
        `💸 **Withdrawal Request**\n\n` +
          `🔹 **Amount:** ${DAILY_WITHDRAWAL_LIMIT} ${user.currency}\n` +
          `🔹 **VAT Fee (${VAT_PERCENTAGE}%):** ${vatFee.toFixed(2)} ${user.currency}\n` +
          `🔹 **You’ll Receive:** ${finalAmount.toFixed(2)} ${user.currency}\n\n` +
          `Confirm this withdrawal?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Confirm', 'confirm_withdrawal')],
          [Markup.button.callback('❌ Cancel', 'cancel_withdrawal')],
        ])
      );
    } catch (error) {
      console.error('Error in withdrawal handler:', error.message);
      return ctx.reply('⚠️ Something went wrong. Please try again later.');
    }
  });

  // Handle withdrawal confirmation
  bot.action('confirm_withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ No active withdrawal process found.');
      }

      if (user.balance < DAILY_WITHDRAWAL_LIMIT) {
        return ctx.replyWithMarkdown(
          `❌ **Insufficient Balance**\n` +
            `Your balance: ${user.balance.toFixed(2)} ${user.currency}`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'clear')]])
        );
      }

      // Placeholder account details (replace with user-provided data)
      const accountNumber = '0781292722'; // TODO: Replace with user.usdtAddress or bank details
      const accountBank = '044'; // TODO: Replace with dynamic bank code

      // Calculate withdrawal amounts
      const vatFee = (DAILY_WITHDRAWAL_LIMIT * VAT_PERCENTAGE) / 100;
      const finalAmount = DAILY_WITHDRAWAL_LIMIT - vatFee;

      // Initiate Flutterwave transfer
      const transferResponse = await flw.Transfer.initiate({
        account_bank: accountBank,
        account_number: accountNumber,
        amount: finalAmount,
        narration: 'Bet The Dice Withdrawal',
        currency: user.currency,
        reference: `tx-ref-${Date.now()}`,
      });

      if (transferResponse.status === 'success') {
        user.balance -= DAILY_WITHDRAWAL_LIMIT;
        await user.save();

        return ctx.replyWithMarkdown(
          `✅ **Withdrawal Successful!**\n\n` +
            `🔹 **Requested:** ${DAILY_WITHDRAWAL_LIMIT} ${user.currency}\n` +
            `🔹 **VAT Fee:** ${vatFee.toFixed(2)} ${user.currency}\n` +
            `🔹 **Received:** ${finalAmount.toFixed(2)} ${user.currency}\n` +
            `Thanks for playing!`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'clear')]])
        );
      } else {
        throw new Error(transferResponse.message || 'Transfer failed.');
      }
    } catch (error) {
      console.error('Error confirming withdrawal:', error.message);
      return ctx.replyWithMarkdown(
        `❌ **Withdrawal Failed**\n${error.message}`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'clear')]])
      );
    }
  });

  // Handle withdrawal cancellation
  bot.action('cancel_withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      return ctx.replyWithMarkdown(
        `❌ **Withdrawal Cancelled**\nYou’re back to the main menu.`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'clear')]])
      );
    } catch (error) {
      console.error('Error cancelling withdrawal:', error.message);
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
