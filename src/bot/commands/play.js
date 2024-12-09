const User = require('../../models/User');
const settings = require('../../config/settings'); // For admin IDs
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) {
    ctx.reply(`❌ Debug: Error at ${location}: ${error.message}`);
  }
};

// 10-second cooldown for each user
const COOLDOWN_TIME = 10000; // 10 seconds
const LOSS_LIMIT = 500; // Daily loss limit
const ADMIN_ID = settings.adminIds; // Admin's Telegram ID
const COMMISSION_RATE = 0.1; // 10%

// Track last game time for each user
const lastGameTime = {};

const rollDiceForUser = async (ctx) => {
  try {
    const diceMessage = await ctx.replyWithDice();
    const diceValue = diceMessage.dice.value;

    setTimeout(async () => {
      try {
        await ctx.deleteMessage(diceMessage.message_id);
      } catch (deleteError) {
        if (deleteError.response && deleteError.response.error_code === 400) {
          console.error('Message cannot be deleted for everyone:', deleteError.message);
        } else {
          logError('deleteMessage error', deleteError, ctx);
        }
      }
    }, 2000);

    return diceValue;
  } catch (error) {
    logError('rollDiceForUser', error, ctx);
    return null;
  }
};

const rollDiceForBot = async (ctx) => {
  try {
    const botDiceMessage = await ctx.replyWithHTML('🤖 Bot is rolling the dice...');
    const diceValue = Math.floor(Math.random() * 6) + 1;

    setTimeout(async () => {
      try {
        await ctx.deleteMessage(botDiceMessage.message_id);
      } catch (deleteError) {
        if (deleteError.response && deleteError.response.error_code === 400) {
          console.error('Message cannot be deleted for everyone:', deleteError.message);
        } else {
          logError('deleteMessage error', deleteError, ctx);
        }
      }
    }, 2000);

    return diceValue;
  } catch (error) {
    logError('rollDiceForBot', error, ctx);
    return null;
  }
};

const startGame = async (ctx, user) => {
  try {
    const currentTime = Date.now();
    const lastGame = lastGameTime[user.telegramId] || 0;

    // Check cooldown (10 seconds)
    if (currentTime - lastGame < COOLDOWN_TIME) {
      return ctx.reply('❌ Please wait a few seconds before playing again.');
    }

    // Update the last game time
    lastGameTime[user.telegramId] = currentTime;

    // Entry fee and loss check
    const betAmount = 100;
    if (user.balance < betAmount) {
      return ctx.reply('❌ Insufficient balance! You need at least 100 to play.');
    }

    // Daily loss limit check
    if (user.dailyLoss >= LOSS_LIMIT) {
      return ctx.reply('❌ You have reached your daily loss limit. Please try again tomorrow.');
    }

    user.balance -= betAmount;
    await user.save();

    const admin = await User.findOne({ telegramId: ADMIN_ID });
    if (!admin) {
      return ctx.reply('❌ Admin account not found. Please contact support.');
    }

    const startMessage = await ctx.replyWithHTML(`🎮 <b>Game Start!</b>\n\n👤 <b>${user.username}</b> is rolling the dice!`);

    const playerRoll = await rollDiceForUser(ctx);
    if (playerRoll === null) return;

    await ctx.deleteMessage(startMessage.message_id);

    const botRoll = await rollDiceForBot(ctx);
    if (botRoll === null) return;

    let resultMessage;
    let dailyLoss = user.dailyLoss;
    let winAmount = 0;

    if (playerRoll > botRoll) {
      winAmount = betAmount * 2;
      const commission = Math.floor(winAmount * COMMISSION_RATE);
      user.balance += winAmount - commission;
      admin.balance += commission;
      resultMessage = `🎉 <b>${user.username}</b> wins with a roll of ${playerRoll} against ${botRoll}!\n💰 <b>You won: ${winAmount - commission} (after commission).</b>`;
      dailyLoss = Math.max(dailyLoss - betAmount, 0); // Reset loss if win
    } else if (botRoll > playerRoll) {
      admin.balance += betAmount;
      dailyLoss += betAmount;
      resultMessage = `🤖 <b>Bot</b> wins with a roll of ${botRoll} against ${playerRoll}!\n💸 <b>Your bet has been added to admin's balance.</b>`;
    } else {
      user.balance += betAmount; // Refund the bet
      resultMessage = `🤝 It's a draw! Both rolled ${playerRoll}. Bet refunded.`;
    }

    // Update daily loss, balance, and admin balance
    user.dailyLoss = dailyLoss;
    await user.save();
    await admin.save();

    // Add new balance to result message
    resultMessage += `\n🔹 <b>Your new balance: ${user.balance}</b>`;

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

const playCommand = (bot) => {
  bot.action('play', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      await startGame(ctx, user);
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  bot.command('play', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
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
