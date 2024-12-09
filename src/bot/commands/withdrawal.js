const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');

// Flutterwave API keys
const FLUTTERWAVE_SECRET_KEY = settings.flutterwaveSecretKey || process.env.FLUTTERWAVE_SECRET_KEY;
const FLUTTERWAVE_PUBLIC_KEY = settings.flutterwavePublicKey || process.env.FLUTTERWAVE_PUBLIC_KEY;

const DAILY_WITHDRAWAL_LIMIT = 100; // Default withdrawal amount
const VAT_PERCENTAGE = 7.5; // VAT fee percentage

module.exports = (bot) => {
  // Withdrawal action handler
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

      // Ask for bank details
      await ctx.replyWithHTML(
        `💳 <b>Withdrawal Process</b>\n\n` +
          `Please provide your account number and bank name in the format:\n` +
          `<code>AccountNumber BankName</code>\n\nExample:\n<code>1234567890 Zenith</code>`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
      );

      // Set user state for withdrawal process
      user.state = 'withdrawal_bank_details';
      await user.save();
    } catch (error) {
      console.error('Error in withdrawal handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle bank details input
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user || user.state !== 'withdrawal_bank_details') return;

      const [accountNumber, ...bankNameParts] = ctx.message.text.split(' ');
      const bankName = bankNameParts.join(' ');

      if (!accountNumber || !bankName) {
        return ctx.replyWithHTML(
          `❌ <b>Invalid input.</b>\nPlease send your details in this format:\n<code>AccountNumber BankName</code>`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
        );
      }

      try {
        // Verify account with Flutterwave
        const verifyResponse = await axios.post(
          'https://api.flutterwave.com/v3/accounts/resolve',
          { account_number: accountNumber, account_bank: bankName },
          { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` } }
        );

        const { account_name } = verifyResponse.data.data;

        // Save bank details to user
        user.bankAccountNumber = accountNumber;
        user.bankName = bankName;
        user.bankAccountName = account_name;
        user.state = 'withdrawal_confirmation';
        await user.save();

        // Show confirmation details
        const vatFee = (DAILY_WITHDRAWAL_LIMIT * VAT_PERCENTAGE) / 100;
        const finalAmount = DAILY_WITHDRAWAL_LIMIT - vatFee;

        return ctx.replyWithHTML(
          `✅ <b>Bank details verified:</b>\n\n` +
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
          `❌ <b>Failed to verify bank details.</b>\nPlease check your details and try again.`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
        );
      }
    } catch (error) {
      console.error('Error handling bank details:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle confirmation
  bot.action('confirm_withdrawal', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user || user.state !== 'withdrawal_confirmation') {
        return ctx.reply('❌ No active withdrawal process.');
      }

      // Initiate withdrawal
      try {
        const withdrawResponse = await axios.post(
          'https://api.flutterwave.com/v3/transfers',
          {
            account_bank: user.bankName,
            account_number: user.bankAccountNumber,
            amount: DAILY_WITHDRAWAL_LIMIT,
            narration: 'Telegram Bot Withdrawal',
            currency: 'NGN',
          },
          { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` } }
        );

        if (withdrawResponse.data.status === 'success') {
          user.balance -= DAILY_WITHDRAWAL_LIMIT;
          user.state = null;
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
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      user.state = null;
      await user.save();

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
