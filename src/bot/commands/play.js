const { joinQueue, leaveQueue } = require('../../utils/matchmaking');
const diceRoll = require('../../utils/dice');
const User = require('../../models/User');
const settings = require('../../config/settings');
const { Markup } = require('telegraf');

const playCommand = async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';

    try {
      // Retrieve user from database
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Check if user is already in a game
      if (user.state === 'in-game') {
        return ctx.reply('❌ You are already in a game. Please finish the current game first.');
      }

      // Prompt user for game mode (2-player or 4-player)
      user.state = 'selecting-mode';
      await user.save();

      return ctx.reply(
        `🎮 Choose a game mode:\n\n` +
        `- 2-player: Face off against one opponent.\n` +
        `- 4-player: Battle three opponents for a bigger prize!\n`,
        Markup.inlineKeyboard([
          [Markup.button.callback('2 Players', 'mode_2')],
          [Markup.button.callback('4 Players', 'mode_4')],
        ])
      );
    } catch (error) {
      console.error('Error in /play command:', error.message);
      return ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  bot.action(/mode_(\d+)/, async (ctx) => {
    const telegramId = ctx.from.id;
    const mode = parseInt(ctx.match[1], 10); // Extract game mode (2 or 4 players)

    try {
      const user = await User.findOne({ telegramId });
      if (!user || user.state !== 'selecting-mode') return;

      user.state = 'betting';
      user.gameMode = mode;
      await user.save();

      await ctx.answerCbQuery();
      return ctx.reply(
        `💰 Enter your bet amount (min: ${settings.minBet}, max: ${settings.maxBet}):\n\n` +
        `Your current balance: ${user.balance}`
      );
    } catch (error) {
      console.error('Error selecting game mode:', error.message);
      return ctx.reply('❌ An unexpected error occurred. Please try again.');
    }
  });

  bot.on('message', async (ctx) => {
    const telegramId = ctx.from.id;
    const userInput = ctx.message.text;

    try {
      // Retrieve user from database
      const user = await User.findOne({ telegramId });
      if (!user || user.state !== 'betting') return;

      const betAmount = parseFloat(userInput);

      // Validate bet amount
      if (isNaN(betAmount)) {
        user.state = null;
        user.gameMode = null;
        await user.save();
        return ctx.reply('❌ Invalid amount. Please enter a valid number.');
      }

      if (betAmount < settings.minBet || betAmount > settings.maxBet) {
        user.state = null;
        user.gameMode = null;
        await user.save();
        return ctx.reply(
          `❌ Invalid bet amount. Please enter an amount between ${settings.minBet} and ${settings.maxBet}.`
        );
      }

      const vatFee = parseFloat((betAmount * settings.vatRate) / 100).toFixed(2);
      const totalBet = parseFloat(betAmount + parseFloat(vatFee));

      if (totalBet > user.balance) {
        user.state = null;
        user.gameMode = null;
        await user.save();
        return ctx.reply(
          `❌ Insufficient balance! Your balance: ${user.balance}. Total needed: ${totalBet}.`
        );
      }

      // Deduct the bet amount and update state
      user.balance -= totalBet;
      user.state = 'in-game';
      user.currentBet = betAmount;
      await user.save();

      ctx.reply(
        `🎲 Bet placed! Bet: ${betAmount}, VAT: ${vatFee}. Remaining balance: ${user.balance}.\n\n` +
        `⏳ Searching for opponents...`
      );

      // Matchmaking logic for 2 or 4 players
      const players = joinQueue({ telegramId, username }, user.gameMode);
      if (players.length < user.gameMode) {
        setTimeout(async () => {
          if (user.state === 'in-game') {
            user.state = null;
            user.gameMode = null;
            await user.save();
            leaveQueue({ telegramId, username });
            ctx.reply('❌ Matchmaking timed out. Please try again later.');
          }
        }, settings.matchmakingTimeout);
        return;
      }

      // Dice rolls and determine the winner
      const rolls = players.map((player) => ({ ...player, roll: diceRoll() }));
      const winner = rolls.reduce((acc, curr) => (curr.roll > acc.roll ? curr : acc), rolls[0]);

      // Update the winner's balance
      const winnerUser = await User.findOne({ telegramId: winner.telegramId });
      const winnings = players.reduce((sum, player) => sum + player.currentBet, 0);
      winnerUser.balance += winnings;

      // Reset all players' states
      for (const player of players) {
        const playerUser = await User.findOne({ telegramId: player.telegramId });
        playerUser.state = null;
        playerUser.currentBet = null;
        await playerUser.save();
      }

      // Notify all players of results
      for (const player of rolls) {
        ctx.telegram.sendMessage(
          player.telegramId,
          `🎲 You rolled: ${player.roll}.\n` +
          `${player.telegramId === winner.telegramId ? '🎉 You win!' : '❌ You lose.'}`
        );
      }

      // Announce the winner
      ctx.telegram.sendMessage(
        winner.telegramId,
        `🎉 Congratulations! You won ${winnings}! Your new balance: ${winnerUser.balance}`
      );

      leaveQueue(...players);
    } catch (error) {
      console.error('Error during gameplay:', error.message);
      ctx.reply('❌ An unexpected error occurred during gameplay. Please try again later.');
    }
  });
};

module.exports = playCommand;
