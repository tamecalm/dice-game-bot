const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');
const paystack = require('paystack-api')(settings.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY);

const MIN_WITHDRAWAL = 100; // Updated minimum withdrawal amount
const MAX_WITHDRAWAL = 5000; // Maximum withdrawal amount
const WITHDRAWAL_FEE_PERCENTAGE = 2; // Withdrawal fee percentage

module.exports = (bot) => {
  // Action handler for the withdrawal option
  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      await ctx.replyWithHTML(
        `💳 <b>Bank Transfer Withdrawal</b>\n\n` +
          `Please provide your bank details to proceed.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
      );

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

      if (!user || !user.state || !user.state.startsWith('withdrawal')) {
        return;
      }

      if (user.state === 'withdrawal_bank_details') {
        const [accountNumber, bankCode] = ctx.message.text.split(' ');

        if (!accountNumber || !bankCode) {
          return ctx.replyWithHTML(
            `❌ <b>Invalid input.</b>\nPlease send your bank details in this format:\n` +
              `<code>AccountNumber BankCode</code>\n\nExample:\n<code>1234567890 044</code>`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Menu', 'menu')],
            ])
          );
        }

        const bankDetailsResponse = await paystack.verification.resolveAccount({
          account_number: accountNumber,
          bank_code: bankCode,
        });

        const { account_name } = bankDetailsResponse.data;

        user.bankAccountNumber = accountNumber;
        user.bankCode = bankCode;
        user.bankAccountName = account_name;
        user.state = 'withdrawal_amount';
        await user.save();

        return ctx.replyWithHTML(
          `✅ <b>Bank details verified:</b>\n\n` +
            `🔹 Account Name: ${account_name}\n` +
            `🔹 Account Number: ${accountNumber}\n` +
            `🔹 Bank Code: ${bankCode}\n\n` +
            `💳 <b>Now, enter the amount you wish to withdraw:</b>\n` +
            `💰 <b>Balance:</b> ${user.balance.toFixed(2)} NGN\n` +
            `📋 <i>Note:</i>\n` +
            `- Minimum: ${MIN_WITHDRAWAL} NGN\n` +
            `- Maximum: ${MAX_WITHDRAWAL} NGN\n` +
            `- Fee: ${WITHDRAWAL_FEE_PERCENTAGE}%`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'menu')],
          ])
        );
      } else if (user.state === 'withdrawal_amount') {
        const withdrawalAmount = parseFloat(ctx.message.text);

        if (
          isNaN(withdrawalAmount) ||
          withdrawalAmount < MIN_WITHDRAWAL ||
          withdrawalAmount > MAX_WITHDRAWAL
        ) {
          return ctx.replyWithHTML(
            `❌ <b>Invalid amount.</b>\nPlease enter a value between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} NGN.`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Menu', 'menu')],
            ])
          );
        }

        if (withdrawalAmount > user.balance) {
          return ctx.replyWithHTML(
            `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Menu', 'menu')],
            ])
          );
        }

        const fee = (withdrawalAmount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
        const finalAmount = withdrawalAmount - fee;
        const withdrawalId = `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Deduct balance and reset user state
        user.balance -= withdrawalAmount;
        user.state = null;
        await user.save();

        // Simulate withdrawal success
        return ctx.replyWithHTML(
          `✅ <b>Withdrawal Successful!</b>\n\n` +
            `🔹 <b>Amount:</b> ${finalAmount.toFixed(2)} NGN\n` +
            `🔹 <b>Fee:</b> ${fee.toFixed(2)} NGN\n` +
            `🔹 <b>Withdrawal ID:</b> ${withdrawalId}\n\n` +
            `💳 <b>Bank Transfer has been initiated.</b>\nThank you for using our service.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'menu')],
          ])
        );
      }
    } catch (error) {
      console.error('Error in withdrawal process:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
