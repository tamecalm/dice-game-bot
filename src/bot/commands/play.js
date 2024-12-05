const { joinQueue, leaveQueue } = require('../../utils/matchmaking');
const diceRoll = require('../../utils/dice');
const User = require('../../models/User');
const settings = require('../../config/settings');

module.exports = async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || 'Anonymous';

  // Retrieve user from database
  const user = await User.findOne({ telegramId });

  if (!user) {
    return ctx.reply('You are not registered. Use /start to register.');
  }

  // Check if user has a pending state
  if (user.state === 'in-game') {
    return ctx.reply('You are already in a game. Please finish the current game first.');
  }

  // Ask user to enter bet amount
  user.state = 'betting'; // Update user state to 'betting'
  await user.save();

  ctx.reply(`Enter the amount you want to bet (min: ${settings.minBet}, max: ${settings.maxBet}):`);

  // Wait for bet amount
  ctx.telegram.once('text', async (message) => {
    const betAmount = parseFloat(message.text);

    // Validate bet amount
    if (isNaN(betAmount)) {
      user.state = null; // Clear state
      await user.save();
      return ctx.reply('Invalid amount. Please enter a valid number.');
    }

    if (betAmount < settings.minBet) {
      user.state = null;
      await user.save();
      return ctx.reply(`The minimum bet amount is ${settings.minBet}. Please enter a higher amount.`);
    }

    if (betAmount > settings.maxBet) {
      user.state = null;
      await user.save();
      return ctx.reply(`The maximum bet amount is ${settings.maxBet}. Please enter a lower amount.`);
    }

    const vatFee = parseFloat((betAmount * settings.vatRate) / 100).toFixed(2); // Calculate VAT
    const totalBet = betAmount + parseFloat(vatFee); // Total amount to deduct

    if (totalBet > user.balance) {
      user.state = null; // Clear state
      await user.save();
      return ctx.reply(
        `Insufficient balance! Your current balance is ${user.balance}. Total required: ${totalBet}`
      );
    }

    // Deduct total amount (including VAT) from user balance
    user.balance -= totalBet;
    user.state = 'in-game'; // Update user state to 'in-game'
    user.currentBet = betAmount; // Save the bet amount
    await user.save();

    ctx.reply(
      `🎲 Your bet is placed! Bet: ${betAmount}, VAT: ${vatFee}. Remaining balance: ${user.balance}. Waiting for an opponent...`
    );

    // Matchmake with another player
    const pair = joinQueue({ telegramId, username });

    if (!pair) {
      return ctx.reply('Waiting for another player...');
    }

    // Dice rolling logic
    const [player1, player2] = pair;
    const player1Roll = diceRoll();
    const player2Roll = diceRoll();

    const winner = player1Roll > player2Roll ? player1 : player2;

    // Update balances
    const winnerUser = await User.findOne({ telegramId: winner.telegramId });
    if (winnerUser) {
      const winnings = player1Roll > player2Roll
        ? player2.currentBet * 2
        : player1.currentBet * 2;
      winnerUser.balance += winnings;
      await winnerUser.save();
    }

    // Notify players of results
    ctx.telegram.sendMessage(player1.telegramId, `🎲 You rolled: ${player1Roll}`);
    ctx.telegram.sendMessage(player2.telegramId, `🎲 You rolled: ${player2Roll}`);

    // Declare winner
    await ctx.telegram.sendMessage(
      winner.telegramId,
      `🎉 You win! 🎲 Final roll: ${player1.username} (${player1Roll}) vs ${player2.username} (${player2Roll}). Winnings: ${player1Roll > player2Roll ? player2.currentBet : player1.currentBet} `
    );

    // Clear states for both players
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
  });
};