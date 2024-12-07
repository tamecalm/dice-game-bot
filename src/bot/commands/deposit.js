const axios = require('axios');
const User = require('../../models/User');
const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);
const settings = require('../../config/settings');

// State management for deposit process
const userDepositState = {};

// Helper: Fetch exchange rates (currently commented out)
// const getExchangeRates = async (baseCurrency) => {
//   try {
//     const response = await axios.get(
//       `https://v6.exchangerate-api.com/v6/caadc6a03dcb054f3906bd95/latest/${baseCurrency}`
//     );
//     return response.data.rates;
//   } catch (error) {
//     console.error('Error fetching exchange rates:', error.message);
//     return null;
//   }
// };

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
        currency: 'USD', // Default currency set to USD
      };

      return ctx.reply(
        `💳 Welcome to the deposit process!\n` +
          `Please enter the amount you'd like to deposit.\n` +
          `Note: Minimum deposit is ${settings.minimumDeposit} USD.`
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
            return ctx.reply(`❌ Invalid amount. Minimum deposit is ${settings.minimumDeposit} USD.`);
          }

          // Commented out exchange rate logic
          // const exchangeRates = await getExchangeRates('USD');
          // if (!exchangeRates) {
          //   return ctx.reply('❌ Error fetching exchange rates. Please try again later.');
          // }
          // const exchangeRate = exchangeRates[state.currency] || 1;

          const vatRate = settings.vatRate / 100;
          const vatFee = (amount * vatRate).toFixed(2);
          const totalAmount = (parseFloat(amount) + parseFloat(vatFee)).toFixed(2);

          // Update state with calculated values
          Object.assign(state, { amount, vatFee, totalAmount, step: 2 });

          return ctx.reply(
            `🧾 <b>Deposit Details:</b>\n` +
              `- Amount: USD ${amount}\n` +
              `- VAT (${settings.vatRate}%): USD ${vatFee}\n` +
              `- Total: USD ${totalAmount}\n\n` +
              `✅ Confirm payment by typing "YES" or cancel with "CANCEL".`,
            { parse_mode: 'HTML' }
          );
        }

        case 2: {
          // Handle confirmation or cancellation
          if (userInput.toLowerCase() === 'cancel') {
            delete userDepositState[userId];
            return ctx.reply('❌ Deposit process canceled.');
          }

          if (userInput.toLowerCase() !== 'yes') {
            return ctx.reply('❌ Invalid response. Please type "YES" to confirm or "CANCEL" to cancel.');
          }

          // Initialize Paystack transaction
          const { amount, totalAmount, vatFee } = state;
          try {
            const transaction = await paystack.transaction.initialize({
              email: `${userId}@example.com`, // Replace with actual user email in production
              amount: totalAmount * 100, // Convert to smallest currency unit
              currency: 'USD',
              callback_url: `${process.env.PAYSTACK_CALLBACK_URL}`,
              metadata: { userId, amount, vatFee },
            });

            // Clear user state after payment initialization
            delete userDepositState[userId];

            return ctx.reply(
              `✅ <b>Payment Summary:</b>\n` +
                `- Amount: USD ${amount}\n` +
                `- VAT: USD ${vatFee}\n` +
                `- Total: USD ${totalAmount}\n\n` +
                `💳 Complete your payment using this link:\n${transaction.data.authorization_url}`,
              { parse_mode: 'HTML' }
            );
          } catch (paystackError) {
            console.error('Error initializing Paystack transaction:', paystackError.stack);
            delete userDepositState[userId];
            return ctx.reply('❌ Failed to initialize payment. Please try again later.');
          }
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

  // Global error handler for uncaught errors in this file
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.stack || err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', promise, 'Reason:', reason.stack || reason);
  });
};
