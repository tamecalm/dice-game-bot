const User = require('../../models/User');

module.exports = (bot) => {
  // Inline button action for "Withdrawal"
  bot.action('withdrawal', async (ctx) => {
    try {
      // Acknowledge the button click
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id;

      // Check if the user is registered
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Prompt user for withdrawal amount
      await ctx.reply(
        `💳 Please enter the amount you wish to withdraw.\n\n` +
          `💰 Current Balance: ${user.balance.toFixed(2)} ${user.currency}`
      );

      // Update user state for withdrawal
      user.state = 'withdrawing';
      await user.save();
    } catch (error) {
      console.error('Error in withdrawal button handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle user input after prompting for withdrawal amount
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const userInput = ctx.message.text;

      // Retrieve the user
      const user = await User.findOne({ telegramId });
      if (!user || user.state !== 'withdrawing') return;

      // Parse the withdrawal amount
      const withdrawalAmount = parseFloat(userInput);
      if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        user.state = null;
        await user.save();
        return ctx.reply('❌ Invalid amount. Please enter a valid withdrawal amount.');
      }

      // Check if the user has enough balance
      if (user.balance < withdrawalAmount) {
        user.state = null;
        await user.save();
        return ctx.reply(
          `❌ Insufficient balance. Your balance is ${user.balance.toFixed(2)} ${user.currency}.`
        );
      }

      // Deduct the withdrawal amount and reset user state
      user.balance -= withdrawalAmount;
      user.state = null;
      await user.save();

      // Confirm successful withdrawal
      return ctx.reply(
        `✅ Withdrawal successful!\n💳 Amount: ${withdrawalAmount.toFixed(2)} ${
          user.currency
        }\n💰 Remaining Balance: ${user.balance.toFixed(2)} ${user.currency}`
      );
    } catch (error) {
      console.error('Error in withdrawal process:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
