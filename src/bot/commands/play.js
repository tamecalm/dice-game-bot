const { joinQueue, leaveQueue } = require('../../utils/matchmaking');
const diceRoll = require('../../utils/dice');
const User = require('../../models/User');
const settings = require('../../config/settings');

module.exports = (bot) => {
  bot.command('play', async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';

    // Retrieve user from database
    const user = await User.findOne({ telegramId });

    if (!user) {
      return ctx.reply('You are not registered. Use /start to register.');
    }

    // Check if user is already in a game
    if (user.state === 'in-game') {
      return ctx.reply('You are already in a game. Please finish the current game first.');
    }

    // Ask user to enter a bet amount
    user.state = 'betting'; // Set state to 'betting'
    await user.save();

    ctx.reply(`Enter the amount you want to bet (min: ${settings.minBet}, max: ${settings.maxBet}):`);

    const onMessage = async (messageCtx) => {
      // Ensure it's the same user
      if (messageCtx.from.id !== telegramId) return;

      const betAmount = parseFloat(messageCtx.message.text);

      // Validate bet amount
      if (isNaN(betAmount)) {
        user.state = null; // Clear state
        await user.save();
        messageCtx.reply('Invalid amount. Please enter a valid number.');
        bot.off('text', onMessage); // Stop listening
        return;
      }

      if (betAmount < settings.minBet) {
        user.state = null;
        await user.save();
        messageCtx.reply(`The minimum bet amount is ${settings.minBet}. Please enter a higher amount.`);
        bot.off('text', onMessage); // Stop listening
        return;
      }

      if (betAmount > settings.maxBet) {
        user.state = null;
        await user.save();
        messageCtx.reply(`The maximum bet amount is ${settings.maxBet}. Please enter a lower amount.`);
        bot.off('text', onMessage); // Stop listening
        return;
      }

      const vatFee = parseFloat((betAmount * settings.vatRate) / 100).toFixed(2);
      const totalBet = betAmount + parseFloat(vatFee);

      if (totalBet > user.balance) {
        user.state = null;
        await user.save();
        messageCtx.reply(
          `Insufficient balance! Your current balance is ${user.balance}. Total required: ${totalBet}`
        );
        bot.off('text', onMessage); // Stop listening
        return;
      }

      // Deduct the bet amount from the user's balance
      user.balance -= totalBet;
      user.state = 'in-game';
      user.currentBet = betAmount;
      await user.save();

      messageCtx.reply(
        `🎲 Your bet is placed! Bet: ${betAmount}, VAT: ${vatFee}. Remaining balance: ${user.balance}. Waiting for an opponent...`
      );

      // Matchmaking logic
      const pair = joinQueue({ telegramId, username });

      if (!pair) {
        messageCtx.reply('Waiting for another player...');
        bot.off('text', onMessage); // Stop listening
        return;
      }

      // Dice roll and determine winner
      const [player1, player2] = pair;
      const player1Roll = diceRoll();
      const player2Roll = diceRoll();

      const winner = player1Roll > player2Roll ? player1 : player2;

      // Update winner's balance
      const winnerUser = await User.findOne({ telegramId: winner.telegramId });
      if (winnerUser) {
        const winnings = player1Roll > player2Roll
          ? player2.currentBet * 2
          : player1.currentBet * 2;
        winnerUser.balance += winnings;
        await winnerUser.save();
      }

      // Notify both players of the result
      await ctx.telegram.sendMessage(player1.telegramId, `🎲 You rolled: ${player1Roll}`);
      await ctx.telegram.sendMessage(player2.telegramId, `🎲 You rolled: ${player2Roll}`);

      // Announce the winner
      await ctx.telegram.sendMessage(
        winner.telegramId,
        `🎉 You win! 🎲 Final roll: ${player1.username} (${player1Roll}) vs ${player2.username} (${player2Roll}). Winnings: ${player1Roll > player2Roll ? player2.currentBet : player1.currentBet}`
      );

      // Clear state for both players
      const loser = winner === player1 ? player2 : player1;
      const loserUser = await User.findOne({ telegramId: loser.telegramId });
      if (loserUser) {
        loserUser.state = null;
        loserUser.currentBet = null;
        await loserUser.save();
      }

      winnerUser.state = null;
      winnerUser.currentBet = null;
      await winnerUser.save();

      leaveQueue(player1);
      leaveQueue(player2);
      bot.off('text', onMessage); // Stop listening after game ends
    };

    bot.on('text', onMessage); // Listen for text messages
  });
};
