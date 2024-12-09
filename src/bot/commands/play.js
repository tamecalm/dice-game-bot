const User = require('../../models/User');
const { Markup } = require('telegraf');

// Debugging utilities
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) {
    ctx.reply(`❌ Debug: Error at ${location}: ${error.message}`);
  }
};

const logDebug = (location, message) => {
  console.log(`DEBUG: ${location} - ${message}`);
};

// Function to simulate animated dice roll
const animatedDiceRoll = async (ctx) => {
  const diceFaces = ['🎲', '🎲', '🎲', '🎲', '🎲', '🎲']; // Animation frames
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < diceFaces.length; i++) {
    await ctx.replyWithHTML(`<b>Rolling...</b> ${diceFaces[i]}`);
    await delay(500); // 0.5-second delay
  }

  const diceResult = Math.floor(Math.random() * 6) + 1;
  await ctx.replyWithHTML(`<b>Final Result:</b> ${'🎲'.repeat(diceResult)} (Value: ${diceResult})`);
  return diceResult;
};

// Function to start the game
const startGame = async (ctx, user) => {
  try {
    logDebug('startGame', `Starting game for user: ${user.username}`);

    // Deduct bet amount from user
    const betAmount = 100;
    user.balance -= betAmount;
    await user.save();

    await ctx.replyWithHTML(`🎮 <b>Game Start!</b>\n\n👤 <b>${user.username}</b> is rolling the dice!`);

    // Player rolls the dice
    const playerRoll = await animatedDiceRoll(ctx);

    // Bot rolls the dice
    await ctx.replyWithHTML(`🤖 <b>Bot</b> is rolling the dice!`);
    const botRoll = await animatedDiceRoll(ctx);

    // Determine winner
    let resultMessage;
    if (playerRoll > botRoll) {
      resultMessage = `🎉 <b>${user.username}</b> wins with a roll of ${playerRoll} against ${botRoll}!`;
      user.balance += betAmount * 2; // Double the bet amount
      await user.save();
    } else if (botRoll > playerRoll) {
      resultMessage = `🤖 <b>Bot</b> wins with a roll of ${botRoll} against ${playerRoll}!`;
    } else {
      resultMessage = `🤝 It's a draw! Both rolled ${playerRoll}. Bet refunded.`;
      user.balance += betAmount; // Refund the bet
      await user.save();
    }

    await ctx.replyWithHTML(resultMessage);
  } catch (error) {
    logError('startGame', error, ctx);
  }
};

// Play command
const playCommand = (bot) => {
  bot.action('play', async (ctx) => {
    try {
      logDebug('playCommand', `Received 'play' action from user: ${ctx.from.id}`);
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (user.balance < 100) {
        return ctx.reply('❌ Insufficient balance! You need at least 100 to play.');
      }

      await startGame(ctx, user);
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  bot.command('play', async (ctx) => {
    try {
      logDebug('playCommand', `Received /play command from user: ${ctx.from.id}`);

      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (user.balance < 100) {
        return ctx.reply('❌ Insufficient balance! You need at least 100 to play.');
      }

      await startGame(ctx, user);
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  bot.catch((error, ctx) => {
    logError('Global Error Handler', error, ctx);
  });
};

module.exports = playCommand;
