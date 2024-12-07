const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');
const MIN_WITHDRAWAL = 500; // Minimum withdrawal amount in NGN
const MAX_WITHDRAWAL = 500000; // Maximum withdrawal amount in NGN
const WITHDRAWAL_FEE_PERCENTAGE = 2; // Withdrawal fee in percentage
const EXCHANGE_RATE_API = process.env.EXCHANGE_RATE_API_KEY; // Exchange Rate API
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

      // Show withdrawal method options
      await ctx.replyWithHTML(
        `💳 <b>Withdrawal Options</b>\n\n` +
          `Please select your preferred withdrawal method:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🏦 Bank Transfer (NGN)', 'bank_transfer')],
          [Markup.button.callback('💸 USDT (Binance)', 'usdt')],
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
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

      if (method === 'usdt') {
        // USDT withdrawal step: Validate wallet address
        user.state = 'withdrawal_usdt_address';
        user.tempAmount = parseFloat(userInput); // Store withdrawal amount temporarily
        await user.save();

        await ctx.replyWithHTML(
          `🏦 <b>Enter your USDT Wallet Address:</b>\n\n` +
            `📋 Ensure your address is correct to avoid loss of funds.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Amount Input', 'withdrawal_usdt')],
          ])
        );
      } else if (method === 'bank_transfer') {
        // Handle NGN bank transfer logic here...
      }
    } catch (error) {
      console.error('Error in withdrawal amount input:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle USDT address input
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const userInput = ctx.message.text;
      const user = await User.findOne({ telegramId });

      if (user && user.state === 'withdrawal_usdt_address') {
        // Validate the wallet address format (simple validation for example purposes)
        if (!userInput || userInput.length < 20) {
          return ctx.replyWithHTML(
            `❌ <b>Invalid USDT Wallet Address.</b>\nPlease enter a valid wallet address.`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Amount Input', 'withdrawal_usdt')],
            ])
          );
        }

        // Deduct the fee, confirm withdrawal
        const fee = (user.tempAmount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
        const finalAmount = user.tempAmount - fee;

        if (user.tempAmount > user.balance) {
          return ctx.replyWithHTML(
            `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Amount Input', 'withdrawal_usdt')],
            ])
          );
        }

        user.balance -= user.tempAmount;
        user.state = null;
        await user.save();

        // Process withdrawal using Binance API
        await processUSDTWithdrawal(ctx, userInput, finalAmount, fee, user);
      }
    } catch (error) {
      console.error('Error in USDT address input:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  async function processUSDTWithdrawal(ctx, walletAddress, amount, fee, user) {
    try {
      // Call Binance API to process USDT withdrawal
      const response = await axios.post(
        'https://api.binance.com/sapi/v1/capital/withdraw/apply',
        {
          asset: 'USDT',
          address: walletAddress,
          amount: amount.toFixed(2),
          network: 'TRC20', // Or the appropriate network
        },
        {
          headers: {
            'X-MBX-APIKEY': BINANCE_API_KEY,
          },
          auth: {
            username: BINANCE_API_KEY,
            password: BINANCE_API_SECRET,
          },
        }
      );

      const transactionId = response.data.id;

      // Notify user of successful withdrawal
      await ctx.replyWithHTML(
        `✅ <b>USDT Withdrawal Successful!</b>\n\n` +
          `💳 <b>Amount:</b> ${amount.toFixed(2)} USDT\n` +
          `💸 <b>Fee Deducted:</b> ${fee.toFixed(2)} NGN\n` +
          `🆔 <b>Transaction ID:</b> ${transactionId}\n\n` +
          `💰 <b>New Balance:</b> ${user.balance.toFixed(2)} NGN`
      );
    } catch (error) {
      console.error('Error in USDT withdrawal:', error.message);
      await ctx.reply('❌ Failed to process USDT withdrawal. Please try again later.');
    }
  }
};
