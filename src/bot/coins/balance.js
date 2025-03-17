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

import axios from 'axios'; // ES6 import
import User from '../../models/User.js'; // ES6 import
import { Markup } from 'telegraf'; // ES6 import
import settings from '../../config/settings.js'; // ES6 import

// Reusable function to fetch and format balance
const getBalanceMessage = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return {
        text: '❌ **Not Registered**\nUse /start to join.',
        options: null,
      };
    }

    const formattedBalance = user.balance.toFixed(0); // No decimals
    const currency = user.currency || settings.defaultCurrency || 'NGN'; // Use user.currency with fallback

    let balanceInUSD = 'N/A';
    let exchangeRateMessage = `*🌍 USD balance unavailable due to connectivity issues.*`;

    try {
      const response = await axios.get(
        `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/${currency}`
      );
      const usdRate = response.data.conversion_rates.USD;
      if (usdRate && usdRate > 0) {
        balanceInUSD = (user.balance * usdRate).toFixed(2);
        exchangeRateMessage = `🌍 **Exchange Rate:** 1 ${currency} = $${usdRate.toFixed(4)}\n` +
          `💵 **USD Balance:** $${balanceInUSD}`;
      }
    } catch (apiError) {
      console.error('Exchange rate API error:', apiError.message);
    }

    const text = `📊 **Your Balance**\n\n` +
      `💰 **Balance:** ${formattedBalance} ${currency}\n\n` +
      `${exchangeRateMessage}\n\n` +
      `*Note: Exchange rates are approximate and may vary.*`;

    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            Markup.button.callback('⬅️ Back', 'clear'),
            Markup.button.callback('🔄 Refresh', 'balance'),
          ],
        ],
      },
    };

    return { text, options };
  } catch (error) {
    console.error('Error fetching balance:', error.message);
    return {
      text: '⚠️ **Error**\nSomething went wrong. Try again later.',
      options: null,
    };
  }
};

export default (bot) => {
  // Inline button handler for "Balance"
  bot.action('balance', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;
      const { text, options } = await getBalanceMessage(telegramId);
      await ctx.replyWithMarkdown(text, options);
    } catch (error) {
      console.error('Error in balance action:', error.message);
      await ctx.replyWithMarkdown('⚠️ **Error**\nSomething went wrong.');
    }
  });

  // Command handler for "/balance" (simplified to reuse logic)
  bot.command('balance', async (ctx) => {
    const telegramId = ctx.from.id;
    const { text, options } = await getBalanceMessage(telegramId);
    await ctx.replyWithMarkdown(text, options);
  });
};

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
