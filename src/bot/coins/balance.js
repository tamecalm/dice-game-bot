// src/bot/coins/balance.js
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

export function setupBalance(bot) {
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
}