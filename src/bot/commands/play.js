const { joinQueue } = require('../../utils/matchmaking');
const diceRoll = require('../../utils/dice');
const User = require('../../models/User');
const settings = require('../../config/settings');
const { Markup } = require('telegraf');

// Debugging utility
const logError = (location, error) => {
  console.error(`Error at ${location}:`, error.message);
};

const playCommand = (bot) => {
  // Inline button handler for "Play" action
  bot.action('play', async (ctx) => {
    try {
      await ctx.answerCbQuery(); // Notify user
      await ctx.telegram.sendMessage(ctx.from.id, '🎮 Loading game setup...');
      return bot.handleUpdate({
        message: {
          ...ctx.update.callback_query.message,
          text: '/play',
        },
      });
    } catch (error) {
      logError('Inline button handler', error);
      ctx.reply('❌ An error occurred while starting the game. Please try again.');
    }
  });

  bot.action('play', async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';

    try {
      // Fetch user from the database
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Check if user is already in a game
      if (user.state === 'in-game') {
        return ctx.reply('❌ You are already in a game. Please finish your current game first.');
      }

      // Update user state to 'betting'
      user.state = 'betting';
      await user.save();

      return ctx.reply(
        `💰 Enter your bet amount (min: ${settings.minBet}, max: ${settings.maxBet}):\n\n` +
          `Your current balance: ${user.balance}`
      );
    } catch (error) {
      logError('/play command', error);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Message handler for bet input
  bot.on('message', async (ctx) => {
    const telegramId = ctx.from.id;
    const userInput = ctx.message.text;

    try {
      const user = await User.findOne({ telegramId });
      if (!user || user.state !== 'betting') return;

      const betAmount = parseFloat(userInput);

      if (isNaN(betAmount) || betAmount < settings.minBet || betAmount > settings.maxBet) {
        user.state = null;
        await user.save();
        return ctx.reply(
          `❌ Invalid bet amount. Please enter an amount between ${settings.minBet} and ${settings.maxBet}.`
        );
      }

      const vatFee = parseFloat((betAmount * settings.vatRate) / 100).toFixed(2);
      const totalBet = parseFloat(betAmount) + parseFloat(vatFee);

      if (totalBet > user.balance) {
        user.state = null;
        await user.save();
        return ctx.reply(
          `❌ Insufficient balance! Your balance: ${user.balance}. Total needed: ${totalBet}.`
        );
      }

      // Deduct bet, proceed to matchmaking
      user.balance -= totalBet;
      user.state = 'in-game';
      user.currentBet = betAmount;
      await user.save();

      ctx.reply(
        `🎲 Bet placed! Bet: ${betAmount}, VAT: ${vatFee}. Remaining balance: ${user.balance}.\n\n` +
          `⏳ Searching for opponents...`
      );

      const players = joinQueue({ telegramId, username });
      if (players.length >= 2) {
        // Proceed with matchmaking and gameplay
        ctx.reply('✅ Match found! Starting the game...');
        diceRoll(players); // Call dice roll logic here
      } else {
        ctx.reply('⏳ Waiting for more players to join...');
      }
    } catch (error) {
      logError('Betting and matchmaking', error);
      ctx.reply('❌ An error occurred during the game setup. Please try again later.');
    }
  });

  // Error handler
  bot.catch((error, ctx) => {
    logError('Global Error Handler', error);
    ctx.reply('❌ A critical error occurred. Please contact support.');
  });
};

module.exports = playCommand;
