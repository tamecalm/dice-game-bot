const User = require('../../models/User');
const { Markup } = require('telegraf');
const settings = require('../../config/settings'); // Import settings to access defaultCurrency

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

      // Use defaultCurrency from settings
      const currency = settings.defaultCurrency;

      // Respond with user's balance
      return ctx.replyWithHTML(
        `💰 <b>Your Balance:</b> ${formattedBalance} ${currency}\n\n` +
        `🔄 <i>Need to top up? Use the /deposit command.</i>`,
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

      // Use defaultCurrency from settings
      const currency = settings.defaultCurrency;

      // Respond with user's balance
      return ctx.replyWithHTML(
        `💰 <b>Your Balance:</b> ${formattedBalance} ${currency}\n\n` +
        `🔄 <i>Need to top up? Use the /deposit command.</i>`,
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
