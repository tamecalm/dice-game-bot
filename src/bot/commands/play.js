const User = require('../../models/User');

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

// Function to roll a dice and send animation to user or bot
const rollDiceForUser = async (ctx, userType) => {
  try {
    if (userType === 'user') {
      // Send dice roll animation to user only
      const result = await ctx.replyWithDice();
      return result.dice.value;
    } else {
      // Bot rolls the dice but does not send it to the user
      await ctx.replyWithDice({ reply_markup: { hide_keyboard: true } });
      return Math.floor(Math.random() * 6) + 1; // Simulating bot's dice roll
    }
  } catch (error) {
    logError('rollDiceForUser', error, ctx);
    return null;
  }
};

// Function to start the game
const startGame = async (ctx, user) => {
  try {
    logDebug('startGame', `Starting game for user: ${user.username}`);

    const betAmount = 100;
    user.balance -= betAmount;
    await user.save();

    // Send initial message for the game start
    let gameMessage = await ctx.replyWithHTML(`🎮 <b>Game Start!</b>\n\n👤 <b>${user.username}</b> is rolling the dice!`);

    // Wait for user to roll the dice
    const playerRoll = await rollDiceForUser(ctx, 'user');
    if (playerRoll === null) return; // Handle potential errors in dice roll

    // Delete the "Game Started" message after the user rolls their dice
    await ctx.deleteMessage(gameMessage.message_id);

    // Edit the message to show the bot is rolling
    gameMessage = await ctx.replyWithHTML('🤖 <b>Bot</b> is rolling the dice...');

    // Bot rolls the dice (but the user will not see it)
    const botRoll = await rollDiceForUser(ctx, 'bot');
    if (botRoll === null) return; // Handle potential errors in dice roll

    // After both dice are rolled, show the result
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

    // Edit the message with the final result
    const resultMarkup = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Play Again', callback_data: 'play' }],
          [{ text: 'Back to Menu', callback_data: 'menu' }],
        ],
      },
    };
    await ctx.editMessageText(resultMessage, resultMarkup);
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

  // Handle back to menu action
  bot.action('menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      // Your back to menu handler logic here
      await ctx.reply('🔙 Returning to menu...');
    } catch (error) {
      logError('back_to_menu', error, ctx);
    }
  });

  // Handle play again action
  bot.action('play', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (user.balance < 100) {
        return ctx.reply('❌ Insufficient balance! You need at least 100 to play again.');
      }

      await startGame(ctx, user);
    } catch (error) {
      logError('play_again', error, ctx);
    }
  });

  bot.catch((error, ctx) => {
    logError('Global Error Handler', error, ctx);
  });
};

module.exports = playCommand;
