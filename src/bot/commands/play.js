const User = require('../../models/User');
const settings = require('../../config/settings'); // For admin IDs
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) {
    ctx.reply(`❌ Debug: Error at ${location}: ${error.message}`);
  }
};

// 10-second cooldown for each user
const COOLDOWN_TIME = 300000; // 10 seconds
const ADMIN_ID = settings.adminIds; // Admin's Telegram ID
const COMMISSION_RATE = 0.3; // 30%

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

const confirmGame = async (ctx, user, betAmount) => {
  try {
    const confirmationMessage = await ctx.replyWithHTML(
      `🎮 <b>Game Confirmation</b>

💵 <b>Bet Amount:</b> ${betAmount}
🔹 <b>Your Balance:</b> ${user.balance}

Do you want to proceed?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, Play', callback_data: `start_game_${betAmount}` },
              { text: '❌ Cancel', callback_data: 'cancel_game' },
            ],
          ],
        },
      }
    );

    return confirmationMessage;
  } catch (error) {
    logError('confirmGame', error, ctx);
  }
};

const startGame = async (ctx, user, betAmount) => {
  try {
    const currentTime = Date.now();
    const lastGame = lastGameTime[user.telegramId] || 0;

    // Check cooldown (10 seconds)
    if (currentTime - lastGame < COOLDOWN_TIME) {
      return ctx.reply('❌ Please wait a few seconds before playing again.');
    }

    // Update the last game time
    lastGameTime[user.telegramId] = currentTime;

    // Entry fee check
    if (user.balance < betAmount) {
      return ctx.reply('❌ Insufficient balance! Please ensure you have enough funds to play.');
    }

    user.balance -= betAmount;
    await user.save();

    const admin = await User.findOne({ telegramId: ADMIN_ID });
    if (!admin) {
      return ctx.reply('❌ Admin account not found. Please contact support.');
    }

    const startMessage = await ctx.replyWithHTML(`🎮 <b>Game Start!</b>

👤 <b>${user.username}</b> is rolling the dice!`);

    const playerRoll = await rollDiceForUser(ctx);
    if (playerRoll === null) return;

    await ctx.deleteMessage(startMessage.message_id);

    const botRoll = await rollDiceForBot(ctx);
    if (botRoll === null) return;

    let resultMessage;
    let winAmount = 0;

    if (playerRoll > botRoll) {
      winAmount = betAmount * 2;
      const commission = Math.floor(winAmount * COMMISSION_RATE);
      user.balance += winAmount - commission;
      admin.balance += commission;
      resultMessage = `🎉 <b>${user.username}</b> wins with a roll of ${playerRoll} against ${botRoll}!
💰 <b>You won: ${winAmount - commission} (after commission).</b>`;
    } else if (botRoll > playerRoll) {
      admin.balance += betAmount;
      resultMessage = `🤖 <b>Bot</b> wins with a roll of ${botRoll} against ${playerRoll}!
💸 <b>Your bet has been added to admin's balance.</b>`;
    } else {
      user.balance += betAmount; // Refund the bet
      resultMessage = `🤝 It's a draw! Both rolled ${playerRoll}. Bet refunded.`;
    }

    // Update balance
    await user.save();
    await admin.save();

    // Add new balance to result message
    resultMessage += `
🔹 <b>Your new balance: ${user.balance}</b>`;

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
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Send prompt for bet amount
      await ctx.reply('💵 Please enter the amount you want to bet (100 - 5000):');

      const messageHandler = async (messageCtx) => {
        try {
          const betAmount = parseInt(messageCtx.message.text, 10);

          if (isNaN(betAmount)) {
            return messageCtx.reply('❌ Please enter a numeric value.');
          }
          if (betAmount < 100 || betAmount > 5000) {
            return messageCtx.reply('❌ Invalid amount. Enter a value between 100 and 5000.');
          }

          // Valid bet amount, proceed to confirmation
          await confirmGame(messageCtx, user, betAmount);

          // Remove listener after successful input
          bot.removeListener('text', messageHandler);
        } catch (error) {
          logError('playCommand messageHandler', error, messageCtx);
        }
      };

      // Add listener for the next user message
      bot.on('text', messageHandler);

      // Set a timeout to remove the listener if no response is received
      setTimeout(() => {
        bot.removeListener('text', messageHandler);
        ctx.reply('❌ Timeout! Please use /play again if you still want to play.');
      }, 60000); // 1-minute timeout
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  bot.action(/start_game_(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const betAmount = parseInt(ctx.match[1], 10);
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      await startGame(ctx, user, betAmount);
    } catch (error) {
      logError('startGame action', error, ctx);
    }
  });

  bot.action('cancel_game', async (ctx) => {
    try {
      await ctx.answerCbQuery('Game cancelled.');
      await ctx.reply('❌ Game has been cancelled. You can type /play to start again.');
    } catch (error) {
      logError('cancelGame', error, ctx);
    }
  });

  bot.catch((error, ctx) => {
    logError('Global Error Handler', error, ctx);
  });
};

module.exports = playCommand;
