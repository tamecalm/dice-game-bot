const User = require('../../models/User');

module.exports = (bot) => {
  bot.command('🏦 Withdrawal', async (ctx) => {
    try {
      if (!ctx || !ctx.from || !ctx.message || !ctx.message.text) {
        console.error('Invalid context object:', ctx);
        return ctx.reply('An error occurred. Please try again later.');
      }

      const telegramId = ctx.from.id;
      const commandArgs = ctx.message.text.split(' ').slice(1);
      const withdrawalAmount = parseFloat(commandArgs[0]);

      if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return ctx.reply('❌ Invalid amount. Please provide a valid withdrawal amount.');
      }

      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (user.balance < withdrawalAmount) {
        return ctx.reply(
          `❌ Insufficient balance. Your balance is ${user.balance.toFixed(2)} ${user.currency}.`
        );
      }

      // Deduct amount and save
      user.balance -= withdrawalAmount;
      await user.save();

      return ctx.reply(
        `✅ Withdrawal successful!\n💳 Amount: ${withdrawalAmount.toFixed(2)} ${
          user.currency
        }\n💰 Remaining Balance: ${user.balance.toFixed(2)} ${user.currency}`
      );
    } catch (error) {
      console.error('Error in withdrawal command:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
