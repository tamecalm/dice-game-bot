/*


const { joinQueue } = require('../../utils/matchmaking');
const User = require('../../models/User');
const Game = require('../../models/Game');
const settings = require('../../config/settings');
const { Markup } = require('telegraf');

// Debugging utility
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) {
    ctx.reply(`❌ Debug: Error at ${location}: ${error.message}`);
  }
};

const logDebug = (location, message) => {
  console.log(`DEBUG: ${location} - ${message}`);
};

const animatedDiceRoll = async (ctx) => {
  const diceFaces = ['🎲', '🎲', '🎲', '🎲', '🎲', '🎲'];
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < diceFaces.length; i++) {
    await ctx.replyWithHTML(`<b>Rolling...</b> ${diceFaces[i]}`);
    await delay(500); // 0.5-second delay
  }

  const diceResult = Math.floor(Math.random() * 6) + 1;
  await ctx.replyWithHTML(`<b>Final Result:</b> ${'🎲'.repeat(diceResult)} (Value: ${diceResult})`);
  return diceResult;
};

const startGame = async (ctx, players) => {
  try { // nn
    const [player1, player2] = players;

    await ctx.replyWithHTML(`🎮 <b>Game Start!</b>\n\n👤 <b>${player1.username}</b> vs 👤 <b>${player2.username}</b>`);

    const player1Roll = await animatedDiceRoll(ctx);
    const player2Roll = await animatedDiceRoll(ctx);

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
    logError('Game Logic', error, ctx);
  }
};

const playCommand = (bot) => {
  bot.action('play', async (ctx) => {
    try {
      const telegramId = ctx.from.id;

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
        `Your current balance: ${user.balance}`
      );
    } catch (error) {
      logError('/play command', error, ctx);
    }
  });

  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const userInput = ctx.message.text;

      const user = await User.findOne({ telegramId });
      if (!user || user.state !== 'betting') return;

      const betAmount = parseFloat(userInput);

      if (isNaN(betAmount) || betAmount < settings.minBet || betAmount > settings.maxBet) {
        return ctx.reply(`❌ Invalid bet. Please enter a numeric value between ${settings.minBet} and ${settings.maxBet}.`);
      }

      const vatFee = (betAmount * settings.vatRate) / 100;
      const totalBet = betAmount + vatFee;

      if (totalBet > user.balance) {
        return ctx.reply(`❌ Insufficient balance! Your balance: ${user.balance}. Total needed: ${totalBet}.`);
      }

      user.balance -= totalBet;
      user.state = 'in-queue';
      user.currentBet = betAmount;
      await user.save();

      ctx.reply(
        `🎲 Bet placed! Bet: ${betAmount}, VAT: ${vatFee}. Remaining balance: ${user.balance}.\n\n` +
        `⏳ Searching for opponents...`
      );

      const match = joinQueue({ telegramId, username: ctx.from.username, bet: betAmount });

      if (match) {
        ctx.reply('✅ Match found! Starting the game...');
        await startGame(ctx, match);
      } else {
        ctx.reply('⏳ Waiting for more players to join...');
      }
    } catch (error) {
      logError('Message Handler', error, ctx);
    }
  });
};

module.exports = playCommand;

*/


// against computer


/* 
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
*/