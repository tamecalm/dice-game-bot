const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');
const paystack = require('paystack-api')(settings.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY);

const MIN_WITHDRAWAL = 100; // Minimum withdrawal amount
const MAX_WITHDRAWAL = 5000; // Maximum withdrawal amount
const WITHDRAWAL_FEE_PERCENTAGE = 2; // Withdrawal fee percentage

module.exports = (bot) => {
  // Action handler for the withdrawal option
  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      // Fetch user from DB
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      // Ask for bank details
      await ctx.replyWithHTML(
        `💳 <b>Bank Transfer Withdrawal</b>\n\n` +
          `Please provide your bank details to proceed.\n` +
          `Send your details in the format:\n` +
          `<code>AccountNumber BankCode</code>\n\nExample:\n<code>1234567890 044</code>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
      );

      // Set user state for withdrawal process
      user.state = 'withdrawal_bank_details';
      await user.save();
    } catch (error) {
      console.error('Error in withdrawal action handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle bank details input from the user
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      // If user is not in withdrawal process, exit
      if (!user || !user.state || !user.state.startsWith('withdrawal')) {
        return;
      }

      if (user.state === 'withdrawal_bank_details') {
        const [accountNumber, bankCode] = ctx.message.text.split(' ');

        // If the bank details format is invalid
        if (!accountNumber || !bankCode) {
          return ctx.replyWithHTML(
            `❌ <b>Invalid input.</b>\nPlease send your bank details in this format:\n` +
              `<code>AccountNumber BankCode</code>\n\nExample:\n<code>1234567890 044</code>`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Menu', 'menu')],
            ])
          );
        }

        // Debug: Log received bank details
        console.log('Bank Details received:', accountNumber, bankCode);

        try {
          // Verify account with Paystack API
          const bankDetailsResponse = await paystack.verification.resolveAccount({
            account_number: accountNumber,
            bank_code: bankCode,
          });

          // Debug: Log Paystack response
          console.log('Paystack Response:', bankDetailsResponse);

          const { account_name } = bankDetailsResponse.data;

          // Save verified bank details to the user
          user.bankAccountNumber = accountNumber;
          user.bankCode = bankCode;
          user.bankAccountName = account_name;
          user.state = 'withdrawal_amount'; // Move to amount step
          await user.save();

          // Proceed to amount step
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
        } catch (error) {
          console.error('Error in Paystack verification:', error.message);
          return ctx.replyWithHTML(
            `❌ <b>Bank details verification failed.</b>\nPlease check the details and try again.`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Menu', 'menu')],
            ])
          );
        }
      } else if (user.state === 'withdrawal_amount') {
        const withdrawalAmount = parseFloat(ctx.message.text);

        // Validate the withdrawal amount
        if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAWAL || withdrawalAmount > MAX_WITHDRAWAL) {
          return ctx.replyWithHTML(
            `❌ <b>Invalid amount.</b>\nPlease enter a value between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} NGN.`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Menu', 'menu')],
            ])
          );
        }

        // Check if user has sufficient balance
        if (withdrawalAmount > user.balance) {
          return ctx.replyWithHTML(
            `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.`,
            Markup.inlineKeyboard([
              [Markup.button.callback('⬅️ Back to Menu', 'menu')],
            ])
          );
        }

        // Calculate withdrawal fee
        const fee = (withdrawalAmount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
        const finalAmount = withdrawalAmount - fee;
        const withdrawalId = `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Proceed with confirmation
        return ctx.replyWithHTML(
          `💳 <b>Confirm your withdrawal:</b>\n\n` +
            `🔹 Amount to Withdraw: ${withdrawalAmount.toFixed(2)} NGN\n` +
            `🔹 Fee: ${fee.toFixed(2)} NGN\n` +
            `🔹 Final Amount: ${finalAmount.toFixed(2)} NGN\n` +
            `🔹 Withdrawal ID: ${withdrawalId}\n\n` +
            `Please confirm to proceed or cancel the withdrawal.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirm Withdrawal', `confirm_${withdrawalAmount}`)],
            [Markup.button.callback('❌ Cancel Withdrawal', 'cancel_withdrawal')],
          ])
        );
      }
    } catch (error) {
      console.error('Error in withdrawal process:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle confirmation of withdrawal
  bot.action(/confirm_(\d+)/, async (ctx) => {
    try {
      const withdrawalAmount = parseFloat(ctx.match[1]);
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      // Check user and ensure state is correct
      if (!user || user.state !== 'withdrawal_amount') {
        return ctx.reply('❌ No active withdrawal process.');
      }

      // Deduct the balance and complete the transaction
      const fee = (withdrawalAmount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
      const finalAmount = withdrawalAmount - fee;
      user.balance -= withdrawalAmount;
      user.state = null; // Reset state after transaction
      await user.save();

      // Complete withdrawal
      return ctx.replyWithHTML(
        `✅ <b>Withdrawal Successful!</b>\n\n` +
          `🔹 Amount: ${finalAmount.toFixed(2)} NGN\n` +
          `🔹 Fee: ${fee.toFixed(2)} NGN\n` +
          `🔹 Withdrawal ID: WD-${Date.now()}\n` +
          `💳 <b>Bank Transfer initiated.</b>\nThank you for using our service.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
      );
    } catch (error) {
      console.error('Error in withdrawal confirmation:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle cancellation of withdrawal
  bot.action('cancel_withdrawal', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      // Reset user state
      user.state = null;
      await user.save();

      return ctx.replyWithHTML(
        `❌ Withdrawal process cancelled.\nYou have been returned to the main menu.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')],
        ])
      );
    } catch (error) {
      console.error('Error in withdrawal cancellation:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
