const { joinQueue, leaveQueue } = require('../../utils/matchmaking');
const diceRoll = require('../../utils/dice');
const User = require('../../models/User');
const settings = require('../../config/settings');

module.exports = (bot) => {
  bot.command('play', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const username = ctx.from.username || 'Anonymous';

      // Retrieve user from database
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      // Check if user is already in a game
      if (user.state === 'in-game') {
        return ctx.reply('❌ You are already in a game. Please finish the current game first.');
      }

      // Set state to "betting"
      user.state = 'betting';
      await user.save();

      ctx.reply(`💰 Enter your bet amount (min: ${settings.minBet}, max: ${settings.maxBet}):`);

      const onMessage = async (messageCtx) => {
        try {
          // Ensure it's the same user
          if (messageCtx.from.id !== telegramId) return;

          const betAmount = parseFloat(messageCtx.message.text);

          // Validate bet amount
          if (isNaN(betAmount)) {
            user.state = null; // Clear state
            await user.save();
            messageCtx.reply('❌ Invalid amount. Please enter a valid number.');
            bot.off('message', onMessage);
            return;
          }

          if (betAmount < settings.minBet) {
            user.state = null;
            await user.save();
            messageCtx.reply(`❌ Minimum bet is ${settings.minBet}. Enter a higher amount.`);
            bot.off('message', onMessage);
            return;
          }

          if (betAmount > settings.maxBet) {
            user.state = null;
            await user.save();
            messageCtx.reply(`❌ Maximum bet is ${settings.maxBet}. Enter a lower amount.`);
            bot.off('message', onMessage);
            return;
          }

          const vatFee = parseFloat((betAmount * settings.vatRate) / 100).toFixed(2);
          const totalBet = betAmount + parseFloat(vatFee);

          if (totalBet > user.balance) {
            user.state = null;
            await user.save();
            messageCtx.reply(
              `❌ Insufficient balance! Your balance: ${user.balance}. Total needed: ${totalBet}.`
            );
            bot.off('message', onMessage);
            return;
          }

          // Deduct the bet amount
          user.balance -= totalBet;
          user.state = 'in-game';
          user.currentBet = betAmount;
          await user.save();

          messageCtx.reply(
            `🎲 Bet placed! Bet: ${betAmount}, VAT: ${vatFee}. Remaining balance: ${user.balance}. Waiting for an opponent...`
          );

          // Matchmaking logic
          const pair = joinQueue({ telegramId, username });
          if (!pair) {
            messageCtx.reply('⏳ Waiting for another player...');
            bot.off('message', onMessage);
            setTimeout(async () => {
              if (user.state === 'in-game') {
                user.state = null;
                await user.save();
                leaveQueue({ telegramId, username });
                messageCtx.reply('❌ Matchmaking timed out. Try again later.');
              }
            }, settings.matchmakingTimeout); // Timeout defined in settings
            return;
          }

          // Dice roll and determine winner
          const [player1, player2] = pair;
          const player1Roll = diceRoll();
          const player2Roll = diceRoll();
          const winner = player1Roll > player2Roll ? player1 : player2;

          // Update winner's balance
          const winnerUser = await User.findOne({ telegramId: winner.telegramId });
          const loser = winner === player1 ? player2 : player1;
          const loserUser = await User.findOne({ telegramId: loser.telegramId });

          const winnings = loser.currentBet * 2;
          winnerUser.balance += winnings;

          // Save both users
          winnerUser.state = null;
          winnerUser.currentBet = null;
          loserUser.state = null;
          loserUser.currentBet = null;

          await winnerUser.save();
          await loserUser.save();

          // Notify players
          await ctx.telegram.sendMessage(
            player1.telegramId,
            `🎲 You rolled: ${player1Roll}. ${winner === player1 ? '🎉 You win!' : '❌ You lose.'}`
          );
          await ctx.telegram.sendMessage(
            player2.telegramId,
            `🎲 You rolled: ${player2Roll}. ${winner === player2 ? '🎉 You win!' : '❌ You lose.'}`
          );

          // Announce the winner
          await ctx.telegram.sendMessage(
            winner.telegramId,
            `🎉 Congratulations! You won ${winnings}!`
          );

          leaveQueue(player1);
          leaveQueue(player2);
          bot.off('message', onMessage);
        } catch (error) {
          console.error('Error during game:', error.message);
          messageCtx.reply('❌ An error occurred. Please try again later.');
          bot.off('message', onMessage);
        }
      };

      bot.on('message', onMessage); // Listen for user input
    } catch (error) {
      console.error('Error in play command:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again.');
    }
  });
};
