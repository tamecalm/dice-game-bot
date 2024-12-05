const axios = require('axios');
const User = require('../../models/User');
const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);
const rateLimit = require('telegraf-ratelimit');
const settings = require('../../config/settings');

// Rate-limiting configuration
const limitConfig = {
  window: 60000, // 1 minute
  limit: 3, // Max 3 requests per minute
  onLimitExceeded: (ctx) =>
    ctx.reply('You are sending too many requests. Please wait a moment and try again.'),
};

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
    console.error('Error fetching exchange rates:', error);
    return null;
  }
};

module.exports = (bot) => {
  // Apply rate limiting middleware
  bot.use(rateLimit(limitConfig));

  bot.command('deposit', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user exists in the database
    const user = await User.findOne({ telegramId: userId });
    if (!user) {
      return ctx.reply('You are not registered. Use /start to register.');
    }

    // Reset user's deposit state
    userDepositState[userId] = {
      step: 1,
      amount: null,
      currency: user.currency || settings.defaultCurrency,
    };

    return ctx.reply(
      `Welcome to the deposit process! Please enter the amount you'd like to deposit.\n` +
      `Note: Minimum deposit is ${settings.minimumDeposit} ${settings.defaultCurrency}.`
    );
  });

  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is in the deposit process
    if (!userDepositState[userId]) return;

    const userInput = ctx.message.text;
    const state = userDepositState[userId];

    switch (state.step) {
      case 1: // Validate deposit amount
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

        // Save to state
        state.amount = amount;
        state.vatFee = vatFee;
        state.totalAmount = totalAmount;
        state.step = 2;

        return ctx.reply(
          `Deposit Details:\n` +
          `- Amount: ${state.currency} ${amount}\n` +
          `- VAT (${settings.vatRate}%): ${state.currency} ${vatFee}\n` +
          `- Total: ${state.currency} ${totalAmount}\n\n` +
          `Confirm payment by typing "YES" or cancel with "CANCEL".`
        );

      case 2: // Confirm deposit or cancel
        if (userInput.toLowerCase() === 'cancel') {
          delete userDepositState[userId];
          return ctx.reply('Deposit process canceled.');
        }

        if (userInput.toLowerCase() !== 'yes') {
          return ctx.reply('Invalid response. Please type "YES" to confirm or "CANCEL" to cancel.');
        }

        try {
          // Initialize payment with Paystack
          const transaction = await paystack.transaction.initialize({
            email: `${userId}@example.com`, // Replace with user's email in production
            amount: state.totalAmount * 100, // Convert to smallest currency unit
            currency: state.currency,
            callback_url: `${process.env.PAYSTACK_CALLBACK_URL}`, // Ensure this is defined
            metadata: {
              userId,
              amount: state.amount,
              vatFee: state.vatFee,
            },
          });

          // Clear state after payment initialization
          delete userDepositState[userId];

          return ctx.reply(
            `Payment Summary:\n` +
            `- Amount: ${state.currency} ${state.amount}\n` +
            `- VAT: ${state.currency} ${state.vatFee}\n` +
            `- Total: ${state.currency} ${state.totalAmount}\n\n` +
            `Complete your payment using this link:\n${transaction.data.authorization_url}`
          );
        } catch (error) {
          console.error('Error initializing payment:', error);
          delete userDepositState[userId]; // Clear state on error
          return ctx.reply('An error occurred while initializing payment. Please try again later.');
        }

      default:
        delete userDepositState[userId]; // Clear invalid states
        return ctx.reply('Something went wrong. Please start the deposit process again using /deposit.');
    }
  });
};
