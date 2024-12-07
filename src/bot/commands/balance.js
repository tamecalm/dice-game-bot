const User = require('../../models/User');

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

      // Respond with user's balance
      return ctx.replyWithHTML(
        `💰 <b>Your Balance:</b> ${user.balance.toFixed(2)} ${user.currency}\n\n` +
        `🔄 <i>Need to top up? Use the /deposit command.</i>`
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

      // Respond with user's balance
      return ctx.replyWithHTML(
        `💰 <b>Your Balance:</b> ${user.balance.toFixed(2)} ${user.currency}\n\n` +
        `🔄 <i>Need to top up? Use the /deposit command.</i>`
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
