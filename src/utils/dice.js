// module.exports = () => Math.floor(Math.random() * 6) + 1;
// This is not available again since the dice logic will be called in the same script where the 2 player mode setup is available

// All thanks to Calm for bringing up the idea to develop soemthing like this.
/*
const playCommand = (bot) => {
  bot.action('play', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      const betAmounts = [100, 500, 1000, 1500, 2000, 3000];

      const inlineKeyboard = [
        betAmounts.slice(0, 3).map((amount) => ({ text: `₦${amount}`, callback_data: `bet_${amount}` })),
        betAmounts.slice(3).map((amount) => ({ text: `₦${amount}`, callback_data: `bet_${amount}` })),
      ];

      const betMessage = await ctx.reply('💵 Please select the amount you want to bet:', {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });

      setTimeout(async () => {
        try {
          await ctx.deleteMessage(betMessage.message_id);
        } catch (error) {
          logError('deleteBetMessage', error);
        }
      }, 30000);
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  */