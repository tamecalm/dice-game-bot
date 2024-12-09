const User = require('../../models/User');
const settings = require('../../config/settings'); // Admin IDs stored here

const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) {
    ctx.reply(`❌ Debug: Error at ${location}: ${error.message}`);
  }
};

// Cooldown Map
const cooldowns = new Map();

// Constants
const COOLDOWN_PERIOD = 10 * 1000; // 10 seconds
const DAILY_LOSS_LIMIT = 1000; // Set a daily loss limit

// Calculate Entry Fee (10%)
const calculateEntryFee = (betAmount) => Math.ceil(betAmount * 0.10);

// Handle Cooldown
const handleCooldown = (telegramId) => {
  const now = Date.now();
  if (cooldowns.has(telegramId)) {
    const lastPlayTime = cooldowns.get(telegramId);
    if (now - lastPlayTime < COOLDOWN_PERIOD) {
      return false; // Still in cooldown
    }
  }
  cooldowns.set(telegramId, now);
  return true; // Cooldown passed
};

// Start Game Logic
const startGame = async (ctx, user) => {
  try {
    const betAmount = 100;

    // Enforce Daily Loss Limit
    if (user.dailyLoss >= DAILY_LOSS_LIMIT) {
      return ctx.reply('❌ You have reached your daily loss limit. Try again tomorrow!');
    }

    const entryFee = calculateEntryFee(betAmount);
    const playAmount = betAmount - entryFee;

    // Deduct entry fee and bet amount
    user.balance -= betAmount;
    user.dailyLoss += betAmount; // Track daily losses
    await user.save();

    // Add entry fee to owner account
    const ownerAccount = await User.findOne({ telegramId: { $in: settings.adminIds } });
    if (ownerAccount) {
      ownerAccount.balance += entryFee;
      await ownerAccount.save();
    }

    // Notify user of game start
    const startMessage = await ctx.replyWithHTML(`🎮 <b>Game Start!</b>\n\n👤 <b>${user.username}</b> is rolling the dice!`);

    // User rolls dice
    const playerRoll = await rollDiceForUser(ctx);
    if (playerRoll === null) return;

    // Delete "Game Start" message
    await ctx.deleteMessage(startMessage.message_id);

    // Bot rolls dice
    const botRoll = await rollDiceForBot(ctx);
    if (botRoll === null) return;

    // Determine result
    let resultMessage;
    if (playerRoll > botRoll) {
      resultMessage = `🎉 <b>${user.username}</b> wins with a roll of ${playerRoll} against ${botRoll}!`;
      user.balance += playAmount * 2; // Double the play amount for the winner
      user.dailyLoss -= playAmount; // Adjust daily loss (win back amount)
      await user.save();
    } else if (botRoll > playerRoll) {
      resultMessage = `🤖 <b>Bot</b> wins with a roll of ${botRoll} against ${playerRoll}!`;
    } else {
      resultMessage = `🤝 It's a draw! Both rolled ${playerRoll}. Bet refunded.`;
      user.balance += betAmount; // Refund full bet
      user.dailyLoss -= betAmount; // Adjust daily loss (refund amount)
      await user.save();
    }

    // Send result message with "Play Again" button
    const resultMarkup = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Play Again', callback_data: 'play' }],
        ],
      },
    };
    await ctx.replyWithHTML(resultMessage, resultMarkup);
  } catch (error) {
    logError('startGame', error, ctx);
  }
};

// Play Command with Cooldown Check
const playCommand = (bot) => {
  bot.action('play', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id;

      // Check Cooldown
      if (!handleCooldown(telegramId)) {
        return ctx.reply('⏳ You must wait 10 seconds before playing again!');
      }

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
      const telegramId = ctx.from.id;

      // Check Cooldown
      if (!handleCooldown(telegramId)) {
        return ctx.reply('⏳ You must wait 10 seconds before playing again!');
      }

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
