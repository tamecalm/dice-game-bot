const axios = require('axios');
const User = require('../../models/User');
const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);
const settings = require('../../config/settings');

// State management for deposit process
const userDepositState = {};

// Inline button handler
module.exports = (bot) => {
  bot.action('deposit', async (ctx) => {
    const userId = ctx.from.id;

    try {
      // Fetch user data
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Initialize deposit state
      userDepositState[userId] = {
        step: 1,
        amount: null,
        currency: 'NGN', // Default currency set to NGN (Paystack-supported)
      };

      return ctx.replyWithHTML(
        `💳 <b>Welcome to the deposit process!</b>\n\n` +
          `Please enter the amount you'd like to deposit.\n` +
          `💡 <b>Note:</b> Minimum deposit is <b>${settings.minimumDeposit} NGN</b>.`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Back to Menu', callback_data: 'menu' }],
            ],
          },
        }
      );
    } catch (error) {
      console.error('Error in deposit initialization:', error.stack);
      return ctx.reply('❌ An error occurred while starting the deposit process. Please try again later.');
    }
  });

  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    if (!userDepositState[userId]) return; // Exit if user is not in deposit flow

    const userInput = ctx.message.text;
    const state = userDepositState[userId];

    try {
      switch (state.step) {
        case 1: {
          // Validate deposit amount
          const amount = parseFloat(userInput);
          if (isNaN(amount) || amount < settings.minimumDeposit) {
            return ctx.replyWithHTML(
              `❌ <b>Invalid amount.</b> Minimum deposit is <b>${settings.minimumDeposit} NGN</b>.`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '⬅️ Back to Menu', callback_data: 'menu' }],
                  ],
                },
              }
            );
          }

          const vatRate = settings.vatRate / 100;
          const vatFee = (amount * vatRate).toFixed(2);
          const totalAmount = (parseFloat(amount) + parseFloat(vatFee)).toFixed(2);

          // Update state with calculated values
          Object.assign(state, { amount, vatFee, totalAmount, step: 2 });

          return ctx.replyWithHTML(
            `🧾 <b>Deposit Details:</b>\n\n` +
              `- <b>Amount:</b> NGN ${amount}\n` +
              `- <b>VAT (${settings.vatRate}%):</b> NGN ${vatFee}\n` +
              `- <b>Total:</b> NGN ${totalAmount}\n\n` +
              `💡 Confirm payment by selecting an option below:`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Confirm', callback_data: 'confirm_deposit' },
                    { text: '❌ Cancel', callback_data: 'cancel_deposit' },
                  ],
                  [{ text: '⬅️ Back to Menu', callback_data: 'menu' }],
                ],
              },
            }
          );
        }

        default:
          // Clear invalid states
          delete userDepositState[userId];
          return ctx.reply('❌ Something went wrong. Please restart the deposit process.');
      }
    } catch (error) {
      console.error('Error during deposit process:', error.stack);
      delete userDepositState[userId];
      return ctx.reply('❌ An unexpected error occurred. Please restart the deposit process.');
    }
  });

  // Confirm deposit handler
  bot.action('confirm_deposit', async (ctx) => {
    const userId = ctx.from.id;
    const state = userDepositState[userId];

    if (!state || state.step !== 2) return;

    const { amount, totalAmount, vatFee } = state;

    try {
      const transaction = await paystack.transaction.initialize({
        email: `${userId}@example.com`, // Replace with actual user email in production
        amount: totalAmount * 100, // Convert to smallest currency unit
        currency: 'NGN', // Use NGN as the default currency
        callback_url: `${process.env.PAYSTACK_CALLBACK_URL}`,
        metadata: { userId, amount, vatFee },
      });

      // Clear user state after payment initialization
      delete userDepositState[userId];

      await ctx.replyWithHTML(
        `✅ <b>Payment Summary:</b>\n\n` +
          `- <b>Amount:</b> NGN ${amount}\n` +
          `- <b>VAT:</b> NGN ${vatFee}\n` +
          `- <b>Total:</b> NGN ${totalAmount}\n\n` +
          `💳 <b>Complete your payment using this link:</b>\n${transaction.data.authorization_url}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Back to Menu', callback_data: 'menu' }],
            ],
          },
        }
      );
    } catch (error) {
      console.error('Error initializing Paystack transaction:', error.stack);
      delete userDepositState[userId];
      await ctx.reply('❌ Failed to initialize payment. Please try again later.');
    }
  });

  // Cancel deposit handler
  bot.action('cancel_deposit', async (ctx) => {
    const userId = ctx.from.id;

    if (userDepositState[userId]) {
      delete userDepositState[userId];
    }

    return ctx.replyWithHTML(
      '❌ <b>Deposit process canceled.</b>',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back to Menu', callback_data: 'menu' }],
          ],
        },
      }
    );
  });

  // Global error handler for uncaught errors in this file
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.stack || err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', promise, 'Reason:', reason.stack || reason);
  });
};
