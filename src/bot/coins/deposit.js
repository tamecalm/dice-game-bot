import User from '../../models/User.js'; // ES6 import
import Flutterwave from 'flutterwave-node-v3'; // ES6 import
import settings from '../../config/settings.js'; // ES6 import

// Initialize Flutterwave SDK
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY || settings.flutterwavePublicKey,
  process.env.FLW_SECRET_KEY || settings.flutterwaveSecretKey
);

// State management for deposit process
const userDepositState = {};

export function setupDeposit(bot) {
  // Initiate deposit process
  bot.action('deposit', async (ctx) => {
    const userId = ctx.from.id;

    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
      }

      userDepositState[userId] = {
        step: 1,
        amount: null,
        currency: user.currency || 'NGN', // Use user’s currency from schema
      };

      await ctx.replyWithMarkdown(
        `💳 **Start Your Deposit**\n\n` +
          `Enter the amount you’d like to deposit.\n` +
          `💡 *Minimum: ${settings.minimumDeposit} ${user.currency}*`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_deposit' }]],
          },
        }
      );
    } catch (error) {
      console.error('Error starting deposit:', error.message);
      return ctx.reply('⚠️ Failed to start deposit. Try again later.');
    }
  });

  // Handle user input during deposit flow
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userDepositState[userId];
    if (!state) return; // Exit if not in deposit flow

    const userInput = ctx.message.text;

    try {
      switch (state.step) {
        case 1: {
          const amount = parseFloat(userInput);
          if (isNaN(amount) || amount < settings.minimumDeposit) {
            return ctx.replyWithMarkdown(
              `❌ **Invalid Amount**\nMinimum deposit is ${settings.minimumDeposit} ${state.currency}.`,
              {
                reply_markup: {
                  inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_deposit' }]],
                },
              }
            );
          }

          const vatRate = settings.vatRate / 100 || 0.1; // Default to 10% if not set
          const vatFee = (amount * vatRate).toFixed(2);
          const totalAmount = (amount + parseFloat(vatFee)).toFixed(2);

          Object.assign(state, { amount, vatFee, totalAmount, step: 2 });

          return ctx.replyWithMarkdown(
            `🧾 **Deposit Summary**\n\n` +
              `🔹 **Amount:** ${amount} ${state.currency}\n` +
              `🔹 **VAT (${settings.vatRate || 10}%):** ${vatFee} ${state.currency}\n` +
              `🔹 **Total:** ${totalAmount} ${state.currency}\n\n` +
              `Confirm your payment below:`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Confirm', callback_data: 'confirm_deposit' },
                    { text: '❌ Cancel', callback_data: 'cancel_deposit' },
                  ],
                ],
              },
            }
          );
        }
        default:
          delete userDepositState[userId];
          return ctx.replyWithMarkdown('❌ **Error**\nRestart the deposit process.');
      }
    } catch (error) {
      console.error('Error in deposit flow:', error.message);
      delete userDepositState[userId];
      return ctx.reply('⚠️ Something went wrong. Restart the deposit process.');
    }
  });

  // Confirm deposit and initiate Flutterwave payment
  bot.action('confirm_deposit', async (ctx) => {
    const userId = ctx.from.id;
    const state = userDepositState[userId];

    if (!state || state.step !== 2) return;

    const { amount, totalAmount, vatFee, currency } = state;

    try {
      await ctx.answerCbQuery();

      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        delete userDepositState[userId];
        return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
      }

      const paymentResponse = await flw.Charge.card({
        email: `${userId}@betthedice.com`, // Placeholder email; replace with real email if available
        amount: totalAmount,
        currency: currency,
        tx_ref: `deposit-${userId}-${Date.now()}`,
        redirect_url: process.env.FLW_CALLBACK_URL || 'https://your-callback-url.com',
        meta: { userId, amount, vatFee },
      });

      delete userDepositState[userId];

      if (paymentResponse.status === 'success') {
        await ctx.replyWithMarkdown(
          `✅ **Payment Initiated**\n\n` +
            `🔹 **Amount:** ${amount} ${currency}\n` +
            `🔹 **VAT:** ${vatFee} ${currency}\n` +
            `🔹 **Total:** ${totalAmount} ${currency}\n\n` +
            `💳 Complete your payment here:\n[${paymentResponse.data.link}](${paymentResponse.data.link})`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'clear' }]],
            },
          }
        );
      } else {
        throw new Error('Payment initialization failed.');
      }
    } catch (error) {
      console.error('Error initiating Flutterwave payment:', error.message);
      delete userDepositState[userId];
      await ctx.replyWithMarkdown('❌ **Payment Failed**\nTry again later.');
    }
  });

  // Cancel deposit process
  bot.action('cancel_deposit', async (ctx) => {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery();
      if (userDepositState[userId]) {
        delete userDepositState[userId];
      }
      await ctx.replyWithMarkdown(
        `❌ **Deposit Cancelled**`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'clear' }]],
          },
        }
      );
    } catch (error) {
      console.error('Error cancelling deposit:', error.message);
      await ctx.reply('⚠️ Error cancelling deposit. Try again.');
    }
  });
}