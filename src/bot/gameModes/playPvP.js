// bot/commands/gameModes/playPvP.js
import User from '../../../models/User.js'; // Adjust path
import settings from '../../config/settings.js'; // Adjust path
import createMatchmaking from '../../utils/matchmaking.js'; // Adjust path

const COOLDOWN_TIME = 125000; // 125 seconds
const COMMISSION_RATE = 0.5; // 50% commission
const lastGameTime = {};

const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) ctx.reply(`⚠️ Error at ${location}: ${error.message}`);
};

const rollDiceForPlayer = async (ctx) => {
  try {
    const diceMessage = await ctx.replyWithDice();
    const diceValue = diceMessage.dice.value;
    setTimeout(() => ctx.deleteMessage(diceMessage.message_id).catch(() => {}), 2000);
    return diceValue;
  } catch (error) {
    logError('rollDiceForPlayer', error, ctx);
    return null;
  }
};

const confirmGame = async (ctx, user, betAmount) => {
  try {
    await ctx.replyWithMarkdown(
      `🎲 **Confirm Your Bet (Vs Player)**\n\n` +
        `💵 **Bet Amount:** ${betAmount} ${user.currency}\n` +
        `🔹 **Your Balance:** ${user.balance.toFixed(2)} ${user.currency}\n\n` +
        `Ready to find an opponent?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, Queue', callback_data: `queue_pvp_${betAmount}` },
              { text: '❌ Cancel', callback_data: 'cancel_pvp' },
            ],
          ],
        },
      }
    );
  } catch (error) {
    logError('confirmGamePvP', error, ctx);
  }
};

const startPvPGame = async (ctx, player1, player2, betAmount) => {
  try {
    const currentTime = Date.now();
    if ((lastGameTime[player1.telegramId] && currentTime - lastGameTime[player1.telegramId] < COOLDOWN_TIME) ||
        (lastGameTime[player2.telegramId] && currentTime - lastGameTime[player2.telegramId] < COOLDOWN_TIME)) {
      await ctx.replyWithMarkdown(`⏳ **Cooldown Active**\nOne or both players need to wait.`);
      return;
    }
    lastGameTime[player1.telegramId] = currentTime;
    lastGameTime[player2.telegramId] = currentTime;

    if (player1.balance < betAmount || player2.balance < betAmount) {
      await ctx.replyWithMarkdown(`❌ **Insufficient Funds**\nOne or both need ${betAmount} ${player1.currency}.`);
      return;
    }

    player1.balance -= betAmount;
    player2.balance -= betAmount;
    await player1.save();
    await player2.save();

    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    if (!admin) {
      await ctx.replyWithMarkdown(`❌ **Admin Error**\nContact support—admin not found.`);
      return;
    }

    await ctx.replyWithMarkdown(`🎮 **Match Start!**\n\n👤 **${player1.username}** vs **${player2.username}**`);
    const roll1 = await rollDiceForPlayer(ctx);
    if (roll1 === null) return;

    const roll2 = await rollDiceForPlayer(ctx);
    if (roll2 === null) return;

    let resultMessage;
    let winAmount = betAmount * 2;

    if (roll1 > roll2) {
      const commission = Math.floor(winAmount * COMMISSION_RATE);
      player1.balance += winAmount - commission;
      admin.balance += commission;
      resultMessage = `🎉 **${player1.username} Wins!**\n` +
        `👤 ${player1.username}: ${roll1} vs ${player2.username}: ${roll2}\n` +
        `💰 Won: ${(winAmount - commission).toFixed(2)} ${player1.currency} (after ${commission} commission)`;
    } else if (roll2 > roll1) {
      const commission = Math.floor(winAmount * COMMISSION_RATE);
      player2.balance += winAmount - commission;
      admin.balance += commission;
      resultMessage = `🎉 **${player2.username} Wins!**\n` +
        `👤 ${player1.username}: ${roll1} vs ${player2.username}: ${roll2}\n` +
        `💰 Won: ${(winAmount - commission).toFixed(2)} ${player2.currency} (after ${commission} commission)`;
    } else {
      player1.balance += betAmount;
      player2.balance += betAmount;
      resultMessage = `🤝 **Tie!**\n` +
        `👤 ${player1.username}: ${roll1} vs ${player2.username}: ${roll2}\n` +
        `💵 Bets refunded.`;
    }

    player1.gamesPlayed += 1;
    player2.gamesPlayed += 1;
    await player1.save();
    await player2.save();
    await admin.save();

    resultMessage += `\n\n🔹 **${player1.username} Balance:** ${player1.balance.toFixed(2)} ${player1.currency}` +
      `\n🔹 **${player2.username} Balance:** ${player2.balance.toFixed(2)} ${player2.currency}`;

    await ctx.replyWithMarkdown(resultMessage, {
      reply_markup: {
        inline_keyboard: [[{ text: '🎲 Play Again', callback_data: 'play' }]],
      },
    });

    [player1, player2].forEach(async (player) => {
      await ctx.telegram.sendMessage(
        player.telegramId,
        resultMessage,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🎲 Play Again', callback_data: 'play' }]],
          },
        }
      ).catch((err) => logError('notifyPlayerPvP', err));
    });
  } catch (error) {
    logError('startPvPGame', error, ctx);
  }
};

export default async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });

    if (!user) {
      return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    }

    const betAmounts = [100, 500, 1000, 1500, 2000, 3000];
    const inlineKeyboard = [
      betAmounts.slice(0, 3).map((amount) => ({
        text: `${amount} ${user.currency}`,
        callback_data: `bet_pvp_${amount}`,
      })),
      betAmounts.slice(3).map((amount) => ({
        text: `${amount} ${user.currency}`,
        callback_data: `bet_pvp_${amount}`,
      })),
    ];

    await ctx.replyWithMarkdown(
      `💵 **Bet Against a Player**\n\nChoose your bet amount:`,
      { reply_markup: { inline_keyboard: inlineKeyboard } }
    );
  } catch (error) {
    logError('playPvP', error, ctx);
  }
};

// PvP-specific handlers
export const pvpHandlers = (bot) => {
  const matchmaking = createMatchmaking(bot);

  bot.action(/bet_pvp_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    await confirmGame(ctx, user, betAmount);
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  });

  bot.action(/queue_pvp_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });

    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');

    const player = { telegramId, username: user.username, betAmount };
    const match = matchmaking.joinQueue(player);

    if (match) {
      const [player1Data, player2Data] = match;
      const player1 = await User.findOne({ telegramId: player1Data.telegramId });
      const player2 = await User.findOne({ telegramId: player2Data.telegramId });
      await startPvPGame(ctx, player1, player2, betAmount);
    } else {
      await ctx.replyWithMarkdown(
        `⏳ **Finding Opponent**\n\nWaiting for a ${betAmount} ${user.currency} match...`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_pvp' }]],
          },
        }
      );
    }
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  });

  bot.action('cancel_pvp', async (ctx) => {
    await ctx.answerCbQuery('Game canceled.');
    matchmaking.leaveQueue(ctx.from.id);
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    await ctx.replyWithMarkdown('❌ **Game Cancelled**\nYou’ve left the queue.');
  });
};