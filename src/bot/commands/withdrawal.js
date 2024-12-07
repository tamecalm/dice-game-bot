const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');
const MIN_WITHDRAWAL = 100; // Updated minimum withdrawal amount
const MAX_WITHDRAWAL = 500000; // Maximum withdrawal amount
const WITHDRAWAL_FEE_PERCENTAGE = 2; // Withdrawal fee percentage
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY; // Exchange Rate API Key
const BINANCE_API_KEY = process.env.BINANCE_API_KEY; // Binance API Key
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET; // Binance API Secret

module.exports = (bot) => {
  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      // Check if the user is in Nigeria for bank transfer visibility
      const isNigerian = user.country && user.country.toLowerCase() === 'nigeria';

      // Display withdrawal options
      const options = [
        ...(isNigerian ? [[Markup.button.callback('🏦 Bank Transfer (NGN)', 'bank_transfer')]] : []),
        [Markup.button.callback('💸 USDT (Binance)', 'usdt')],
        [Markup.button.callback('⬅️ Back to Menu', 'menu')],
      ];

      await ctx.replyWithHTML(
        `💳 <b>Withdrawal Options</b>\n\n` +
          `Please select your preferred withdrawal method:`,
        Markup.inlineKeyboard(options)
      );
    } catch (error) {
      console.error('Error in withdrawal handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle withdrawal method selection
  bot.action(['bank_transfer', 'usdt'], async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const method = ctx.callbackQuery.data;

      const methods = {
        bank_transfer: '🏦 Bank Transfer (NGN)',
        usdt: '💸 USDT (Binance)',
      };

      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });
      if (!user) return;

      user.state = `withdrawal_${method}`;
      await user.save();

      await ctx.replyWithHTML(
        `🔢 <b>Enter the amount you wish to withdraw (${methods[method]}):</b>\n` +
          `💰 Current Balance: ${user.balance.toFixed(2)} ${settings.defaultCurrency}\n\n` +
          `📋 <i>Note:</i>\n` +
          `- Minimum: ${MIN_WITHDRAWAL} NGN\n` +
          `- Maximum: ${MAX_WITHDRAWAL} NGN\n` +
          `- Fee: ${WITHDRAWAL_FEE_PERCENTAGE}%`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
        ])
      );
    } catch (error) {
      console.error('Error in withdrawal method selection:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle withdrawal amount input
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const userInput = ctx.message.text;
      const user = await User.findOne({ telegramId });
      if (!user || !user.state || !user.state.startsWith('withdrawal_')) return;

      const method = user.state.split('_')[1];
      const withdrawalAmount = parseFloat(userInput);

      if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAWAL || withdrawalAmount > MAX_WITHDRAWAL) {
        return ctx.replyWithHTML(
          `❌ <b>Invalid amount.</b>\nPlease enter a value between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} NGN.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
          ])
        );
      }

      // Deduct fee and check user balance
      const fee = (withdrawalAmount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
      const finalAmount = withdrawalAmount - fee;

      if (withdrawalAmount > user.balance) {
        return ctx.replyWithHTML(
          `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
          ])
        );
      }

      user.tempAmount = withdrawalAmount;
      user.state = `withdrawal_${method}_details`; // Advance to the next step
      await user.save();

      if (method === 'bank_transfer') {
        // Prompt user for bank details
        await ctx.replyWithHTML(
          `🏦 <b>Enter your bank account details:</b>\n\n` +
            `Format: <code>Account Number, Bank Name</code>\n\n` +
            `📋 Example: <code>1234567890, First Bank</code>`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Amount Input', 'withdrawal_bank_transfer')],
          ])
        );
      } else if (method === 'usdt') {
        // Prompt user for USDT address
        await ctx.replyWithHTML(
          `💸 <b>Enter your USDT Wallet Address:</b>\n\n` +
            `📋 Ensure your address is correct to avoid loss of funds.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Amount Input', 'withdrawal_usdt')],
          ])
        );
      }
    } catch (error) {
      console.error('Error in withdrawal amount input:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle bank details input
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const userInput = ctx.message.text;
      const user = await User.findOne({ telegramId });

      if (user && user.state === 'withdrawal_bank_transfer_details') {
        // Validate and process bank details
        const [accountNumber, bankName] = userInput.split(',').map((v) => v.trim());
        if (!accountNumber || !bankName) {
          return ctx.replyWithHTML(
            `❌ <b>Invalid bank details format.</b>\nPlease provide details as: <code>Account Number, Bank Name</code>`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Amount Input', 'withdrawal_bank_transfer')],
            ])
          );
        }

        // Deduct balance and confirm
        user.balance -= user.tempAmount;
        user.state = null;
        await user.save();

        // Notify user of withdrawal success
        await ctx.replyWithHTML(
          `✅ <b>Bank Transfer Successful!</b>\n\n` +
            `🏦 <b>Bank Name:</b> ${bankName}\n` +
            `🔢 <b>Account Number:</b> ${accountNumber}\n` +
            `💳 <b>Amount:</b> ${user.tempAmount} NGN\n` +
            `💰 <b>Remaining Balance:</b> ${user.balance.toFixed(2)} NGN`
        );
      }
    } catch (error) {
      console.error('Error in bank details input:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
