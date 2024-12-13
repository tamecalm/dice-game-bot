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

const User = require('../../models/User');
const { Markup } = require('telegraf');
const axios = require('axios');
const settings = require('../../config/settings');
require('dotenv').config(); // Load environment variables

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

      // Default variables for USD and exchange rate
      let balanceInUSD = 'N/A';
      let usdRate = null;
      let exchangeRateMessage = `<i>🌍 USD balance is not available at the moment due to connectivity issues.</i>`;

      // Try to fetch exchange rate
      try {
        const exchangeRateResponse = await axios.get(
          `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/NGN`
        );

        // Extract the USD rate from the response
        const conversionRates = exchangeRateResponse.data.conversion_rates;
        usdRate = conversionRates.USD;

        // Ensure the rate exists
        if (usdRate && usdRate > 0) {
          balanceInUSD = (user.balance * usdRate).toFixed(2);
          exchangeRateMessage = `🌍 <b>Exchange Rate:</b> 1 NGN = $${usdRate.toFixed(4)}\n` +
            `<b>💵 USD Balance:</b> $${balanceInUSD}`;
        }
      } catch (apiError) {
        console.error('Exchange rate API error:', apiError.message);
      }

      // Use defaultCurrency from settings
      const currency = settings.defaultCurrency || 'NGN'; // Fallback to NGN if not defined

      // Respond with the balance
      return ctx.replyWithHTML(
        `<b>📊 Account Balance</b>\n\n` +
          `💰 <b>Balance:</b> ${formattedBalance} ${currency}\n\n` +
          `${exchangeRateMessage}\n\n` +
          `<i>Note: Exchange rates are approximate and may vary.</i>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
          [Markup.button.callback('🔄 Refresh Balance', 'balance')]
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

      // Default variables for USD and exchange rate
      let balanceInUSD = 'N/A';
      let usdRate = null;
      let exchangeRateMessage = `<i>🌍 USD balance is not available at the moment due to connectivity issues.</i>`;

      // Try to fetch exchange rate
      try {
        const exchangeRateResponse = await axios.get(
          `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/NGN`
        );

        // Extract the USD rate from the response
        const conversionRates = exchangeRateResponse.data.conversion_rates;
        usdRate = conversionRates.USD;

        // Ensure the rate exists
        if (usdRate && usdRate > 0) {
          balanceInUSD = (user.balance * usdRate).toFixed(2);
          exchangeRateMessage = `🌍 <b>Exchange Rate:</b> 1 NGN = $${usdRate.toFixed(4)}\n` +
            `<b>💵 USD Balance:</b> $${balanceInUSD}`;
        }
      } catch (apiError) {
        console.error('Exchange rate API error:', apiError.message);
      }

      // Use defaultCurrency from settings
      const currency = settings.defaultCurrency || 'NGN'; // Fallback to NGN if not defined

      // Respond with the balance
      return ctx.replyWithHTML(
        `<b>📊 Account Balance</b>\n\n` +
          `💰 <b>Balance:</b> ${formattedBalance} ${currency}\n\n` +
          `${exchangeRateMessage}\n\n` +
          `<i>Note: Exchange rates are approximate and may vary.</i>`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'menu'), Markup.button.callback('🔄 Refresh Balance', 'balance')]
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


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
