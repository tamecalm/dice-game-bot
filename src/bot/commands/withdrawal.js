const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');

// Flutterwave API keys
const FLUTTERWAVE_SECRET_KEY = settings.flutterwaveSecretKey || process.env.FLUTTERWAVE_SECRET_KEY;

const DAILY_WITHDRAWAL_LIMIT = 100; // Default withdrawal amount
const VAT_PERCENTAGE = 7.5; // VAT fee percentage

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

      // Default account details
      const accountNumber = '0781292722';
      const bankName = 'Access Bank';

      try {
        // Verify account with Flutterwave
        const verifyResponse = await axios.post(
          'https://api.flutterwave.com/v3/accounts/resolve',
          { account_number: accountNumber, account_bank: 'accessbank' }, // Flutterwave bank code for Access Bank
          { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` } }
        );

        const { account_name } = verifyResponse.data.data;

        // Show confirmation details
        const vatFee = (DAILY_WITHDRAWAL_LIMIT * VAT_PERCENTAGE) / 100;
        const finalAmount = DAILY_WITHDRAWAL_LIMIT - vatFee;

        return ctx.replyWithHTML(
          `✅ <b>Default Bank Account Details:</b>\n\n` +
            `🔹 Account Name: ${account_name}\n` +
            `🔹 Account Number: ${accountNumber}\n` +
            `🔹 Bank Name: ${bankName}\n\n` +
            `💳 <b>Withdrawal Details</b>\n` +
            `- Amount: ${DAILY_WITHDRAWAL_LIMIT} NGN\n` +
            `- VAT Fee (${VAT_PERCENTAGE}%): ${vatFee.toFixed(2)} NGN\n` +
            `- Final Amount: ${finalAmount.toFixed(2)} NGN\n\n` +
            `Do you want to confirm or cancel this withdrawal?`,
          Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirm', 'confirm_withdrawal')],
            [Markup.button.callback('❌ Cancel', 'cancel_withdrawal')],
          ])
        );
      } catch (error) {
        console.error('Error verifying account:', error.message);
        return ctx.replyWithHTML(
          `❌ <b>Failed to verify default bank details.</b>\nPlease try again later.`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
        );
      }
    } catch (error) {
      console.error('Error in withdrawal handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle confirmation
  bot.action('confirm_withdrawal', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ No active withdrawal process.');
      }

      // Default account details
      const accountNumber = '07181292722';
      const bankName = 'Access Bank';

      // Initiate withdrawal
      try {
        const withdrawResponse = await axios.post(
          'https://api.flutterwave.com/v3/transfers',
          {
            account_bank: 'accessbank', // Flutterwave bank code for Access Bank
            account_number: accountNumber,
            amount: DAILY_WITHDRAWAL_LIMIT,
            narration: 'Telegram Bot Withdrawal',
            currency: 'NGN',
          },
          { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` } }
        );

        if (withdrawResponse.data.status === 'success') {
          user.balance -= DAILY_WITHDRAWAL_LIMIT;
          await user.save();

          return ctx.replyWithHTML(
            `✅ <b>Withdrawal Successful!</b>\n\n` +
              `Amount: ${DAILY_WITHDRAWAL_LIMIT} NGN\n` +
              `VAT Fee: ${(DAILY_WITHDRAWAL_LIMIT * VAT_PERCENTAGE) / 100} NGN\n` +
              `Thank you for using our service.`,
            Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
          );
        } else {
          throw new Error('Flutterwave API returned an error.');
        }
      } catch (error) {
        console.error('Error processing withdrawal:', error.message);
        return ctx.reply('❌ Withdrawal failed. Please try again later.');
      }
    } catch (error) {
      console.error('Error confirming withdrawal:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle cancellation
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
