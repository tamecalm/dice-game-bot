const { joinQueue } = require('../../utils/matchmaking');
const User = require('../../models/User');
const settings = require('../../config/settings');
const { Markup } = require('telegraf');

// Debugging utility
const logError = (location, error) => {
  console.error(`Error at ${location}:`, error.message);
};

// Function to simulate animated dice roll
const animatedDiceRoll = async (ctx) => {
  const diceFaces = ['🎲', '🎲', '🎲', '🎲', '🎲', '🎲']; // Animation frames
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Show animation
  for (let i = 0; i < diceFaces.length; i++) {
    await ctx.replyWithHTML(`<b>Rolling...</b> ${diceFaces[i]}`);
    await delay(500); // 0.5-second delay between frames
  }

  // Final dice result
  const diceResult = Math.floor(Math.random() * 6) + 1; // Dice roll logic
  await ctx.replyWithHTML(`<b>Final Result:</b> ${'🎲'.repeat(diceResult)} (Value: ${diceResult})`);
  return diceResult;
};

// Gameplay logic
const startGame = async (ctx, players) => {
  try {
    const [player1, player2] = players;

    await ctx.replyWithHTML(`🎮 <b>Game Start!</b>\n\n👤 <b>${player1.username}</b> vs 👤 <b>${player2.username}</b>`);

    // Simulate dice rolls for both players
    const player1Roll = await animatedDiceRoll(ctx);
    const player2Roll = await animatedDiceRoll(ctx);

    // Determine the winner
    let resultMessage;
    if (player1Roll > player2Roll) {
      resultMessage = `🎉 <b>${player1.username}</b> wins with a roll of ${player1Roll} against ${player2Roll}!`;
      await User.updateOne({ telegramId: player1.telegramId }, { $inc: { balance: player1.currentBet * 2 }, state: null });
      await User.updateOne({ telegramId: player2.telegramId }, { state: null });
    } else if (player2Roll > player1Roll) {
      resultMessage = `🎉 <b>${player2.username}</b> wins with a roll of ${player2Roll} against ${player1Roll}!`;
      await User.updateOne({ telegramId: player2.telegramId }, { $inc: { balance: player2.currentBet * 2 }, state: null });
      await User.updateOne({ telegramId: player1.telegramId }, { state: null });
    } else {
      resultMessage = `🤝 It's a draw! Both players rolled ${player1Roll}. Bets are refunded.`;
      await User.updateOne({ telegramId: player1.telegramId }, { $inc: { balance: player1.currentBet }, state: null });
      await User.updateOne({ telegramId: player2.telegramId }, { $inc: { balance: player2.currentBet }, state: null });
    }

    await ctx.replyWithHTML(resultMessage);
  } catch (error) {
    logError('Game Logic', error);
    ctx.reply('❌ An error occurred during the game. Please try again later.');
  }
};

const playCommand = (bot) => {
  // Inline button handler for "Play" action
  bot.action('play', async (ctx) => {
    try {
      await ctx.answerCbQuery(); // Notify user
      const telegramId = ctx.from.id;

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
          `Your current balance: ${user.balance}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')], // Inline button to go back to menu
        ])
      );
    } catch (error) {
      logError('Inline button handler', error);
      ctx.reply('❌ An error occurred while starting the game. Please try again.');
    }
  });

  bot.command('play', async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';

    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (user.state === 'in-game') {
        return ctx.reply('❌ You are already in a game. Please finish your current game first.');
      }

      user.state = 'betting';
      await user.save();

      return ctx.reply(
        `💰 Enter your bet amount (min: ${settings.minBet}, max: ${settings.maxBet}):\n\n` +
          `Your current balance: ${user.balance}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Menu', 'menu')], // Inline button to go back to menu
        ])
      );
    } catch (error) {
      logError('/play command', error);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

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
          `❌ Invalid bet amount. Please enter an amount between ${settings.minBet} and ${settings.maxBet}.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'menu')], // Inline button to go back to menu
          ])
        );
      }

      const vatFee = parseFloat((betAmount * settings.vatRate) / 100).toFixed(2);
      const totalBet = parseFloat(betAmount) + parseFloat(vatFee);

      if (totalBet > user.balance) {
        user.state = null;
        await user.save();
        return ctx.reply(
          `❌ Insufficient balance! Your balance: ${user.balance}. Total needed: ${totalBet}.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Menu', 'menu')], // Inline button to go back to menu
          ])
        );
      }

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
        ctx.reply('✅ Match found! Starting the game...');
        await startGame(ctx, players); // Start the game
      } else {
        ctx.reply('⏳ Waiting for more players to join...');
      }
    } catch (error) {
      logError('Betting and matchmaking', error);
      ctx.reply('❌ An error occurred during the game setup. Please try again later.');
    }
  });

  bot.catch((error, ctx) => {
    logError('Global Error Handler', error);
    ctx.reply('❌ A critical error occurred. Please contact support.');
  });
};

module.exports = playCommand;
