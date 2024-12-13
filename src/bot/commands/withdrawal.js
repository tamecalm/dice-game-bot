const { Markup } = require('telegraf');
const User = require('../../models/User');
const Flutterwave = require('flutterwave-node-v3');
const settings = require('../../config/settings');

const DAILY_WITHDRAWAL_LIMIT = 100; // Default withdrawal amount
const VAT_PERCENTAGE = 0.5; // VAT fee percentage

// Initialize Flutterwave SDK
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY || settings.flutterwavePublicKey,
  process.env.FLW_SECRET_KEY || settings.flutterwaveSecretKey
);

module.exports = (bot) => {
  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      // Fetch user from DB
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      // Check if the user has enough balance for withdrawal
      if (user.balance < DAILY_WITHDRAWAL_LIMIT) {
        return ctx.replyWithHTML(
          `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.\n` +
            `Minimum withdrawal is ${DAILY_WITHDRAWAL_LIMIT} NGN.`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
        );
      }

      // Show withdrawal confirmation
      const vatFee = (DAILY_WITHDRAWAL_LIMIT * VAT_PERCENTAGE) / 100;
      const finalAmount = DAILY_WITHDRAWAL_LIMIT - vatFee;

      return ctx.replyWithHTML(
        `💳 <b>Withdrawal Details:</b>\n\n` +
          `🔹 Amount: ${DAILY_WITHDRAWAL_LIMIT} NGN\n` +
          `🔹 VAT Fee (${VAT_PERCENTAGE}%): ${vatFee.toFixed(2)} NGN\n` +
          `🔹 Final Amount: ${finalAmount.toFixed(2)} NGN\n\n` +
          `Do you want to confirm this withdrawal?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Confirm Withdrawal', 'confirm_withdrawal')],
          [Markup.button.callback('❌ Cancel Withdrawal', 'cancel_withdrawal')],
        ])
      );
    } catch (error) {
      console.error('Error in withdrawal handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  bot.action('confirm_withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ No active withdrawal process.');
      }

      if (user.balance < DAILY_WITHDRAWAL_LIMIT) {
        return ctx.replyWithHTML(
          `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
        );
      }

      // Replace with actual account details from the user
      const accountNumber = '0781292722'; // Example account
      const accountBank = 'accessbank'; // Example bank code

      // Initiate withdrawal via Flutterwave
      const vatFee = (DAILY_WITHDRAWAL_LIMIT * VAT_PERCENTAGE) / 100;
      const finalAmount = DAILY_WITHDRAWAL_LIMIT - vatFee;

      try {
        const transferResponse = await flw.Transfer.initiate({
          account_bank: accountBank, // Bank code
          account_number: accountNumber, // Account number
          amount: finalAmount,
          narration: 'Telegram Bot Withdrawal',
          currency: 'NGN',
          reference: `tx-ref-${Date.now()}`, // Unique transaction reference
        });

        if (transferResponse.status === 'success') {
          user.balance -= DAILY_WITHDRAWAL_LIMIT;
          await user.save();

          return ctx.replyWithHTML(
            `✅ <b>Withdrawal Successful!</b>\n\n` +
              `Amount: ${DAILY_WITHDRAWAL_LIMIT} NGN\n` +
              `VAT Fee: ${vatFee.toFixed(2)} NGN\n` +
              `Final Amount Transferred: ${finalAmount.toFixed(2)} NGN\n` +
              `Thank you for using our service.`,
            Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
          );
        } else {
          throw new Error(transferResponse.message);
        }
      } catch (error) {
        console.error('Error initiating withdrawal:', error.message);
        return ctx.replyWithHTML(
          `❌ <b>Withdrawal failed.</b>\n${error.message}`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
        );
      }
    } catch (error) {
      console.error('Error confirming withdrawal:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  bot.action('cancel_withdrawal', async (ctx) => {
    try {
      return ctx.replyWithHTML(
        `❌ Withdrawal cancelled.\nYou have been returned to the main menu.`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
      );
    } catch (error) {
      console.error('Error cancelling withdrawal:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
