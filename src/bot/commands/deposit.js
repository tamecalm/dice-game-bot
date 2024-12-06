const axios = require('axios');
const User = require('../../models/User');
const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);
const settings = require('../../config/settings');

// State management for deposit process
const userDepositState = {};

// Helper: Fetch exchange rates
const getExchangeRates = async (baseCurrency) => {
  try {
    const response = await axios.get(
      `https://v6.exchangerate-api.com/v6/caadc6a03dcb054f3906bd95/latest/${baseCurrency}`
    );
    return response.data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error.message);
    return null;
  }
};

module.exports = (bot) => {
  // Ensure bot is passed correctly and register command handlers
  bot.command('deposit', async (ctx) => {
    const userId = ctx.from.id;

    try {
      // Check if user exists
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return ctx.reply('You are not registered. Use /start to register.');
      }

      // Initialize deposit state
      userDepositState[userId] = {
        step: 1,
        amount: null,
        currency: user.currency || settings.defaultCurrency,
      };

      return ctx.reply(
        `Welcome to the deposit process! Please enter the amount you'd like to deposit.\n` +
        `Note: Minimum deposit is ${settings.minimumDeposit} ${settings.defaultCurrency}.`
      );
    } catch (error) {
      console.error('Error handling /deposit command:', error.message);
      return ctx.reply('An error occurred while starting the deposit process. Please try again later.');
    }
  });

  // Handle user input after the deposit command
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;

    // Exit if user is not in the deposit process
    if (!userDepositState[userId]) return;

    const userInput = ctx.message.text;
    const state = userDepositState[userId];

    try {
      switch (state.step) {
        case 1: {
          // Validate deposit amount
          const amount = parseFloat(userInput);
          if (isNaN(amount) || amount < settings.minimumDeposit) {
            return ctx.reply(
              `Invalid amount. Minimum deposit is ${settings.minimumDeposit} ${settings.defaultCurrency}.`
            );
          }

          // Fetch exchange rates
          const exchangeRates = await getExchangeRates(settings.defaultCurrency);
          if (!exchangeRates) {
            return ctx.reply('Error fetching exchange rates. Please try again later.');
          }

          const exchangeRate = exchangeRates[state.currency] || 1;
          const vatRate = settings.vatRate / 100;
          const vatFee = (amount * vatRate).toFixed(2);
          const totalAmount = (parseFloat(amount) + parseFloat(vatFee)).toFixed(2);

          // Update state with calculated values
          Object.assign(state, { amount, vatFee, totalAmount, step: 2 });

          return ctx.reply(
            `Deposit Details:\n` +
            `- Amount: ${state.currency} ${amount}\n` +
            `- VAT (${settings.vatRate}%): ${state.currency} ${vatFee}\n` +
            `- Total: ${state.currency} ${totalAmount}\n\n` +
            `Confirm payment by typing "YES" or cancel with "CANCEL".`
          );
        }

        case 2: {
          // Handle confirmation or cancellation
          if (userInput.toLowerCase() === 'cancel') {
            delete userDepositState[userId];
            return ctx.reply('Deposit process canceled.');
          }

          if (userInput.toLowerCase() !== 'yes') {
            return ctx.reply('Invalid response. Please type "YES" to confirm or "CANCEL" to cancel.');
          }

          // Initialize Paystack transaction
          const { amount, totalAmount, currency, vatFee } = state;
          const transaction = await paystack.transaction.initialize({
            email: `${userId}@example.com`, // Replace with actual user email in production
            amount: totalAmount * 100, // Convert to smallest currency unit
            currency,
            callback_url: `${process.env.PAYSTACK_CALLBACK_URL}`,
            metadata: { userId, amount, vatFee },
          });

          // Clear user state after payment initialization
          delete userDepositState[userId];

          return ctx.reply(
            `Payment Summary:\n` +
            `- Amount: ${currency} ${amount}\n` +
            `- VAT: ${currency} ${vatFee}\n` +
            `- Total: ${currency} ${totalAmount}\n\n` +
            `Complete your payment using this link:\n${transaction.data.authorization_url}`
          );
        }

        default:
          // Clear invalid states
          delete userDepositState[userId];
          return ctx.reply('Something went wrong. Please restart the deposit process using /deposit.');
      }
    } catch (error) {
      console.error('Error during deposit process:', error.message);

      delete userDepositState[userId];
      return ctx.reply('An error occurred. Please restart the deposit process.');
    }
  });
};
