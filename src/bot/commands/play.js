// Play Logics

const { joinQueue, leaveQueue } = require('../../utils/matchmaking');
const diceRoll = require('../../utils/dice');

module.exports = async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || 'Anonymous';

  const pair = joinQueue({ telegramId, username });
  if (!pair) {
    return ctx.reply('Waiting for another player...');
  }

  const [player1, player2] = pair;
  const player1Roll = diceRoll();
  const player2Roll = diceRoll();

  const winner = player1Roll > player2Roll ? player1 : player2;
  ctx.telegram.sendMessage(player1.telegramId, `🎲 You rolled: ${player1Roll}`);
  ctx.telegram.sendMessage(player2.telegramId, `🎲 You rolled: ${player2Roll}`);

  return ctx.telegram.sendMessage(
    winner.telegramId,
    `🎉 You win! 🎲 Final roll: ${player1.username} (${player1Roll}) vs ${player2.username} (${player2Roll})`
  );
};
