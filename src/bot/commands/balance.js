const User = require('../../models/User');
const { Markup } = require('telegraf');
const axios = require('axios');
const settings = require('../../config/settings');
require('dotenv').config(); // To load environment variables

module.exports = (bot) => {
  // Inline button handler for "Balance"
  bot.action('balance', async (ctx) => {
    try {
      // Acknowledge the callback
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id;

      // Find user by Telegram ID
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML(
          '❌ <b>You are not registered.</b>\nUse <code>/start</code> to register and create an account.'
        );
      }

      // Format the balance (remove decimals)
      const formattedBalance = user.balance.toFixed(0); // Removes decimals

      // Log the default currency to debug
      console.log(`Default Currency: ${settings.defaultCurrency}`);

      // Fetch exchange rate from the API
      const exchangeRateResponse = await axios.get(
        `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/NGN`
      );
      const exchangeRate = exchangeRateResponse.data.conversion_rates.USD || 0;

      // Convert balance to USD
      const balanceInUSD = (user.balance / exchangeRate).toFixed(2);

      // Use defaultCurrency from settings
      const currency = settings.defaultCurrency || 'USD'; // Fallback to USD if not defined

      // Respond with user's balance
      return ctx.replyWithHTML(
        `<b>📊 Balance Information</b>\n\n` +
          `<b>💵 Naira Balance:</b> ${formattedBalance} ${currency}\n` +
          `<b>💲 USD Equivalent:</b> ${balanceInUSD} USD\n\n` +
          `🌍 Exchange Rate: 1 NGN = ${exchangeRate.toFixed(2)} USD\n\n` +
          `<i>Exchange rates are approximate and may vary.</i>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')] // Add back to menu button
        ])
      );
    } catch (error) {
      console.error('Error in balance action:', error.message);

      // Handle unexpected errors
      if (ctx && typeof ctx.reply === 'function') {
        ctx.replyWithHTML(
          '❌ <b>An unexpected error occurred.</b>\nPlease try again later.'
        );
      }
    }
  });

  // Command handler for "/📊 Balance"
  bot.command('📊 Balance', async (ctx) => {
    try {
      const telegramId = ctx.from.id;

      // Find user by Telegram ID
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML(
          '❌ <b>You are not registered.</b>\nUse <code>/start</code> to register and create an account.'
        );
      }

      // Format the balance (remove decimals)
      const formattedBalance = user.balance.toFixed(0); // Removes decimals

      // Log the default currency to debug
      console.log(`Default Currency: ${settings.defaultCurrency}`);

      // Fetch exchange rate from the API
      const exchangeRateResponse = await axios.get(
        `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/NGN`
      );
      const exchangeRate = exchangeRateResponse.data.conversion_rates.USD || 0;

      // Convert balance to USD
      const balanceInUSD = (user.balance / exchangeRate).toFixed(2);

      // Use defaultCurrency from settings
      const currency = settings.defaultCurrency || 'USD'; // Fallback to USD if not defined

      // Respond with user's balance
      return ctx.replyWithHTML(
        `<b>📊 Balance Information</b>\n\n` +
          `<b>💵 Naira Balance:</b> ${formattedBalance} ${currency}\n` +
          `<b>💲 USD Equivalent:</b> ${balanceInUSD} USD\n\n` +
          `🌍 Exchange Rate: 1 NGN = ${exchangeRate.toFixed(2)} USD\n\n` +
          `<i>Exchange rates are approximate and may vary.</i>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')] // Add back to menu button
        ])
      );
    } catch (error) {
      console.error('Error in balance command:', error.message);

      // Handle unexpected errors
      if (ctx && typeof ctx.reply === 'function') {
        ctx.replyWithHTML(
          '❌ <b>An unexpected error occurred.</b>\nPlease try again later.'
        );
      }
    }
  });
};
