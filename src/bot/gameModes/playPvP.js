import User from '../../models/User.js';
import Game from '../../models/Game.js';
import settings from '../../config/settings.js';
import { v4 as uuidv4 } from 'uuid';
import createMatchmaking from '../../utils/matchmaking.js';

// Constants
const MIN_BET = 1;
const MAX_BET = 50;
const COOLDOWN_TIME = 125000; // 125 seconds
const STALE_TIMEOUT = 30 * 1000;
const ANTE_FEE_RATE = 0.05; // 5% ante fee
const LUCKY_ROLL_MULTIPLIER = 1.5; // Bonus for rolling a 6
const JACKPOT_CHANCE = 0.01; // 1% jackpot chance
const JACKPOT_MULTIPLIER = 10;
const DUEL_STREAK_BONUS = 0.10; // 10% bonus for 2 wins
const DUEL_STREAK_CAP = 500;
const RIVALRY_WIN_BONUS = 5; // $5 bonus after 3 wins vs same opponent
const RIVALRY_WIN_THRESHOLD = 3;
const HIGH_ROLLER_COUNT = 3; // 3 max bets trigger curse
const HIGH_ROLLER_CURSE_CHANCE = 0.20; // 20% chance to reduce roll
const BET_ESCALATION_RATE = 1.5; // 50% increase
const ESCALATION_BONUS = 0.20; // 20% bonus
const ESCALATION_CAP = 1000;
const ESCALATION_MAX = 3;
const SUDDEN_DEATH_WINNER_TAKE = 0.75; // 75% of pot
const TAUNT_COST = 10;
const HYPE_FEE = 3; // $3 for crowd hype
const REVENGE_FEE = 5; // $5 for revenge match

// State tracking
const lastGameTime = new Map();
const activeGames = new Set();
const timeouts = new Map();
let currentMessageId = null;

// Log errors
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message || error);
  if (ctx && typeof ctx.reply === 'function') {
    ctx.reply(`⚠️ An error occurred: ${error.message || 'Unknown error'}`).catch(console.error);
  }
};

// Clean up old message
const cleanUpMessage = async (ctx, messageId) => {
  if (messageId && ctx && typeof ctx.deleteMessage === 'function') {
    await ctx.deleteMessage(messageId).catch(() => {});
  }
};

// Roll dice with animation
const rollDiceForPlayer = async (ctx, playerName, telegramId) => {
  try {
    const rollingMsg = await ctx.telegram.sendMessage(telegramId, `🎲 ${playerName} is rolling... 3...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.telegram.editMessageText(telegramId, rollingMsg.message_id, undefined, `🎲 ${playerName} is rolling... 2...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.telegram.editMessageText(telegramId, rollingMsg.message_id, undefined, `🎲 ${playerName} is rolling... 1...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const diceMessage = await ctx.telegram.sendDice(telegramId);
    const diceValue = diceMessage.dice.value;
    await ctx.telegram.deleteMessage(telegramId, rollingMsg.message_id).catch(() => {});
    return { value: diceValue, messageId: diceMessage.message_id };
  } catch (error) {
    logError('rollDiceForPlayer', error, ctx);
    return null;
  }
};

// Confirm game with ante fee
const confirmGame = async (ctx, user, betAmount) => {
  try {
    const anteFee = Math.floor(betAmount * ANTE_FEE_RATE);
    const totalCost = betAmount + anteFee;

    if (user.balance < totalCost) {
      await ctx.reply(`❌ Insufficient Funds\nYou need ${totalCost} ${user.currency}!`);
      activeGames.delete(user.telegramId);
      return;
    }

    const msg = await ctx.reply(
      `🎲 Confirm PvP Bet\n\n` +
      `💵 Bet: ${betAmount} ${user.currency}\n` +
      `📜 Ante Fee (5%): ${anteFee} ${user.currency}\n` +
      `🔹 Total Cost: ${totalCost} ${user.currency}\n` +
      `🔹 Your Balance: ${user.balance.toFixed(2)} ${user.currency}\n\n` +
      `Ready to duel?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes', callback_data: `queue_pvp_${betAmount}` },
              { text: '❌ No', callback_data: 'cancel_pvp' },
            ],
          ],
        },
      }
    );
    currentMessageId = msg.message_id;

    const timeoutId = setTimeout(async () => {
      await cleanUpMessage(ctx, currentMessageId);
      await ctx.reply('⏰ Game cancelled due to inactivity.');
      activeGames.delete(user.telegramId);
      timeouts.delete(user.telegramId);
    }, STALE_TIMEOUT);
    timeouts.set(user.telegramId, timeoutId);
  } catch (error) {
    logError('confirmGame', error, ctx);
  }
};

// Start PvP game
const startPvPGame = async (ctx, player1, player2, betAmount, matchmaking) => {
  try {
    const currentTime = Date.now();
    if (activeGames.has(player1.telegramId) || activeGames.has(player2.telegramId)) {
      await ctx.reply('⏳ One Game at a Time');
      matchmaking.leaveQueue(player1.telegramId);
      matchmaking.leaveQueue(player2.telegramId);
      return;
    }
    activeGames.add(player1.telegramId);
    activeGames.add(player2.telegramId);

    if (currentTime - (lastGameTime.get(player1.telegramId) || 0) < COOLDOWN_TIME ||
        currentTime - (lastGameTime.get(player2.telegramId) || 0) < COOLDOWN_TIME) {
      const remaining = Math.ceil(Math.max(COOLDOWN_TIME - (currentTime - (lastGameTime.get(player1.telegramId) || 0)), COOLDOWN_TIME - (currentTime - (lastGameTime.get(player2.telegramId) || 0))) / 1000);
      await ctx.reply(`⏳ Cooldown: Wait ${remaining}s!`);
      activeGames.delete(player1.telegramId);
      activeGames.delete(player2.telegramId);
      return;
    }
    lastGameTime.set(player1.telegramId, currentTime);
    lastGameTime.set(player2.telegramId, currentTime);

    const anteFee = Math.floor(betAmount * ANTE_FEE_RATE);
    const totalCost = betAmount + anteFee;

    if (player1.balance < totalCost || player2.balance < totalCost) {
      await ctx.reply('❌ Insufficient Funds');
      activeGames.delete(player1.telegramId);
      activeGames.delete(player2.telegramId);
      return;
    }

    player1.balance -= totalCost;
    player2.balance -= totalCost;
    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    if (!admin) throw new Error('Admin not found');
    admin.balance += anteFee * 2; // Deduct from both players
    await player1.save();
    await player2.save();
    await admin.save();

    const gameId = uuidv4();
    const gameMsg = await ctx.reply(`🎮 Match Start!\n${player1.username} vs ${player2.username}\nGame ID: ${gameId.slice(0, 8)}`);
    currentMessageId = gameMsg.message_id;

    const taunt = ctx.session?.taunt;
    if (taunt) {
      await ctx.telegram.sendMessage(player2.telegramId, `🗣️ ${player1.username} taunts: "${taunt}"`);
      admin.balance += TAUNT_COST;
      player1.balance -= TAUNT_COST;
      await admin.save();
      await player1.save();
    }

    if (betAmount === MAX_BET) {
      player1.highRollerCount = (player1.highRollerCount || 0) + 1;
      player2.highRollerCount = (player2.highRollerCount || 0) + 1;
    } else {
      player1.highRollerCount = 0;
      player2.highRollerCount = 0;
    }

    const roll1Result = await rollDiceForPlayer(ctx, player1.username, player1.telegramId);
    if (!roll1Result) return;
    let roll1 = roll1Result.value;
    if (player1.highRollerCount >= HIGH_ROLLER_COUNT && Math.random() < HIGH_ROLLER_CURSE_CHANCE) {
      roll1 = Math.max(1, roll1 - 1);
      await ctx.telegram.sendMessage(player1.telegramId, `👻 High Roller’s Curse! Your roll dropped to ${roll1}!`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await ctx.telegram.deleteMessage(player1.telegramId, roll1Result.messageId).catch(() => {});

    const roll2Result = await rollDiceForPlayer(ctx, player2.username, player2.telegramId);
    if (!roll2Result) return;
    let roll2 = roll2Result.value;
    if (player2.highRollerCount >= HIGH_ROLLER_COUNT && Math.random() < HIGH_ROLLER_CURSE_CHANCE) {
      roll2 = Math.max(1, roll2 - 1);
      await ctx.telegram.sendMessage(player2.telegramId, `👻 High Roller’s Curse! Your roll dropped to ${roll2}!`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await ctx.telegram.deleteMessage(player2.telegramId, roll2Result.messageId).catch(() => {});

    let resultMessage, winAmount = (betAmount * 2);
    const isJackpot = roll1 === 6 && roll2 === 6 && Math.random() < JACKPOT_CHANCE;
    let winner = null, loser = null;

    if (isJackpot) {
      const jackpotAmount = winAmount * JACKPOT_MULTIPLIER;
      player1.balance += Math.floor(jackpotAmount / 2);
      player2.balance += Math.floor(jackpotAmount / 2);
      resultMessage = `🎰 JACKPOT TIE!\nDouble 6s!\nEach wins: ${(jackpotAmount / 2).toFixed(2)} ${player1.currency}`;
    } else if (roll1 === roll2) {
      const suddenDeathMsg = await ctx.reply(`🤝 Tie! Sudden Death Round`);
      const sdRoll1Result = await rollDiceForPlayer(ctx, player1.username, player1.telegramId);
      const sdRoll2Result = await rollDiceForPlayer(ctx, player2.username, player2.telegramId);
      await cleanUpMessage(ctx, suddenDeathMsg.message_id);
      if (!sdRoll1Result || !sdRoll2Result) return;
      const sdRoll1 = sdRoll1Result.value;
      const sdRoll2 = sdRoll2Result.value;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await ctx.telegram.deleteMessage(player1.telegramId, sdRoll1Result.messageId).catch(() => {});
      await ctx.telegram.deleteMessage(player2.telegramId, sdRoll2Result.messageId).catch(() => {});
      if (sdRoll1 > sdRoll2) {
        winAmount = Math.floor(winAmount * SUDDEN_DEATH_WINNER_TAKE);
        player1.balance += winAmount;
        admin.balance += Math.floor(winAmount * (1 - SUDDEN_DEATH_WINNER_TAKE));
        resultMessage = `⚡ Sudden Death! ${player1.username} Wins\n${sdRoll1} vs ${sdRoll2}\n💰 ${winAmount.toFixed(2)} ${player1.currency}`;
        winner = player1;
        loser = player2;
      } else if (sdRoll2 > sdRoll1) {
        winAmount = Math.floor(winAmount * SUDDEN_DEATH_WINNER_TAKE);
        player2.balance += winAmount;
        admin.balance += Math.floor(winAmount * (1 - SUDDEN_DEATH_WINNER_TAKE));
        resultMessage = `⚡ Sudden Death! ${player2.username} Wins\n${sdRoll1} vs ${sdRoll2}\n💰 ${winAmount.toFixed(2)} ${player2.currency}`;
        winner = player2;
        loser = player1;
      } else {
        player1.balance += betAmount;
        player2.balance += betAmount;
        resultMessage = `🤝 Double Tie!\nRefunds issued`;
      }
    } else {
      winAmount = roll1 === 6 || roll2 === 6 ? winAmount * LUCKY_ROLL_MULTIPLIER : winAmount;
      if (roll1 > roll2) {
        if (player1.duelStreak === 1) winAmount += Math.min(winAmount * DUEL_STREAK_BONUS, DUEL_STREAK_CAP);
        if (player1.escalationCount > 0) winAmount += Math.min(winAmount * ESCALATION_BONUS, ESCALATION_CAP);
        player1.balance += winAmount;
        player1.duelStreak += 1;
        player1.wins += 1; // Increment total wins
        player1.weeklyWins = (player1.weeklyWins || 0) + 1; // Increment weekly wins
        player2.duelStreak = 0;
        player2.losses += 1; // Increment losses for loser
        resultMessage = roll1 === 6 ? `🎉 Lucky Roll! ${player1.username} Wins!\n` : `🎉 ${player1.username} Wins!\n`;
        winner = player1;
        loser = player2;
      } else {
        if (player2.duelStreak === 1) winAmount += Math.min(winAmount * DUEL_STREAK_BONUS, DUEL_STREAK_CAP);
        if (player2.escalationCount > 0) winAmount += Math.min(winAmount * ESCALATION_BONUS, ESCALATION_CAP);
        player2.balance += winAmount;
        player2.duelStreak += 1;
        player2.wins += 1; // Increment total wins
        player2.weeklyWins = (player2.weeklyWins || 0) + 1; // Increment weekly wins
        player1.duelStreak = 0;
        player1.losses += 1; // Increment losses for loser
        resultMessage = roll2 === 6 ? `🎉 Lucky Roll! ${player2.username} Wins!\n` : `🎉 ${player2.username} Wins!\n`;
        winner = player2;
        loser = player1;
      }
    }

    if (winner && loser) {
      winner.rivalryScore = winner.rivalryScore || {};
      winner.rivalryScore[loser.telegramId] = (winner.rivalryScore[loser.telegramId] || 0) + 1;
      if (winner.rivalryScore[loser.telegramId] === RIVALRY_WIN_THRESHOLD) {
        winner.balance += RIVALRY_WIN_BONUS;
        resultMessage += `\n🏆 Rivalry Master! ${winner.username} gets ${RIVALRY_WIN_BONUS} ${winner.currency} for ${RIVALRY_WIN_THRESHOLD} wins vs ${loser.username}!`;
        delete winner.rivalryScore[loser.telegramId];
      }
      loser.rivalryScore = loser.rivalryScore || {};
      if (loser.rivalryScore[winner.telegramId] > 0) delete loser.rivalryScore[winner.telegramId];
    }

    player1.gamesPlayed += 1;
    player2.gamesPlayed += 1;
    if (player1.highRollerCount >= HIGH_ROLLER_COUNT && Math.random() < HIGH_ROLLER_CURSE_CHANCE) player1.highRollerCount = 0;
    if (player2.highRollerCount >= HIGH_ROLLER_COUNT && Math.random() < HIGH_ROLLER_CURSE_CHANCE) player2.highRollerCount = 0;
    if (isJackpot || roll1 === roll2) {
      player1.ties += 1;
      player2.ties += 1;
    }
    await player1.save();
    await player2.save();
    await admin.save();

    const game = new Game({
      gameId,
      userId: player1.telegramId,
      opponentId: player2.telegramId,
      betAmount,
      playerRoll: roll1,
      botRoll: roll2,
      outcome: roll1 > roll2 ? 'win' : roll2 > roll1 ? 'loss' : 'tie',
      winnings: roll1 > roll2 ? winAmount : roll2 > roll1 ? winAmount : 0,
      commission: anteFee * 2,
    });
    await game.save();

    resultMessage += `\n🎲 ${player1.username}: ${roll1} vs ${player2.username}: ${roll2}` +
      (player1.duelStreak > 0 ? `\n🔥 ${player1.username} Streak: ${player1.duelStreak}` : '') +
      (player2.duelStreak > 0 ? `\n🔥 ${player2.username} Streak: ${player2.duelStreak}` : '');

    const inlineKeyboard = [
      [
        { text: '🎲 Play', callback_data: 'play_pvp' },
        { text: '📈 Escalate', callback_data: `escalate_pvp_${betAmount}` },
      ],
      [
        { text: '📣 Hype', callback_data: 'hype_pvp' },
        { text: '⚔️ Revenge', callback_data: `revenge_pvp_${winner?.telegramId || player1.telegramId}_${betAmount}` },
        { text: '🗣️ Taunt', callback_data: 'taunt_pvp' },
      ],
    ].filter(row => row.some(btn => btn.callback_data !== `escalate_pvp_${betAmount}` || (winner && winner.escalationCount < ESCALATION_MAX)));

    await ctx.editMessageText(resultMessage, {
      message_id: currentMessageId,
      reply_markup: { inline_keyboard: inlineKeyboard },
    });

    await ctx.telegram.sendMessage(player1.telegramId, `${resultMessage}\n🔹 Your Balance: ${player1.balance.toFixed(2)} ${player1.currency}`, {
      reply_markup: { inline_keyboard: inlineKeyboard },
    }).catch((err) => logError('notifyPlayer1', err));

    await ctx.telegram.sendMessage(player2.telegramId, `${resultMessage}\n🔹 Your Balance: ${player2.balance.toFixed(2)} ${player2.currency}`, {
      reply_markup: { inline_keyboard: inlineKeyboard },
    }).catch((err) => logError('notifyPlayer2', err));

    activeGames.delete(player1.telegramId);
    activeGames.delete(player2.telegramId);
  } catch (error) {
    logError('startPvPGame', error, ctx);
    activeGames.delete(player1.telegramId);
    activeGames.delete(player2.telegramId);
  }
};

// Main entry point
const playPvP = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('❌ Not Registered\nUse /start to join.');

    const betAmounts = [1, 5, 10, 20, 30, 50];
    const inlineKeyboard = [
      betAmounts.slice(0, 3).map((amount) => ({ text: `${amount}`, callback_data: `bet_pvp_${amount}` })),
      betAmounts.slice(3).map((amount) => ({ text: `${amount}`, callback_data: `bet_pvp_${amount}` })),
      [{ text: '🏆 Leaderboard', callback_data: 'show_leaderboard' }],
    ];

    const msg = await ctx.reply(`🎲 Play PvP\nChoose your bet (${user.currency}):`, { reply_markup: { inline_keyboard: inlineKeyboard } });
    currentMessageId = msg.message_id;
  } catch (error) {
    logError('playPvP', error, ctx);
  }
};

// PvP-specific handlers
const pvpHandlers = (bot) => {
  const matchmaking = createMatchmaking(bot);

  bot.action(/bet_pvp_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('❌ Not Registered\nUse /start to join.');
    await cleanUpMessage(ctx, currentMessageId);
    await confirmGame(ctx, user, betAmount);
  });

  bot.action(/queue_pvp_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.reply('❌ Not Registered\nUse /start to join.');
    clearTimeout(timeouts.get(user.telegramId));
    timeouts.delete(user.telegramId);
    const player = {
      telegramId: user.telegramId,
      username: user.username,
      betAmount,
      currency: user.currency,
    };
    const result = await matchmaking.joinQueue(player);
    if (!result.success) return ctx.reply(`❌ Error: ${result.message}`);
    await cleanUpMessage(ctx, currentMessageId);
    if (result.match) {
      const [player1Data, player2Data] = result.match;
      const player1 = await User.findOne({ telegramId: player1Data.telegramId });
      const player2 = await User.findOne({ telegramId: player2Data.telegramId });
      if (!player1 || !player2) return ctx.reply('❌ Error: Player data not found');
      await startPvPGame(ctx, player1, player2, betAmount, matchmaking);
    } else {
      const msg = await ctx.reply(`⏳ Finding Opponent\nWaiting for ${betAmount} ${user.currency} match...`, {
        reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel_pvp' }]] },
      });
      currentMessageId = msg.message_id;
    }
  });

  bot.action('cancel_pvp', async (ctx) => {
    await ctx.answerCbQuery('Game canceled.');
    const userId = ctx.from.id;
    matchmaking.leaveQueue(userId);
    clearTimeout(timeouts.get(userId));
    timeouts.delete(userId);
    await cleanUpMessage(ctx, currentMessageId);
    await ctx.reply('❌ Game Cancelled');
    activeGames.delete(userId);
  });

  bot.action(/escalate_pvp_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    const newBet = Math.min(betAmount * BET_ESCALATION_RATE, MAX_BET);
    user.escalationCount += 1;
    await user.save();
    await cleanUpMessage(ctx, currentMessageId);
    await confirmGame(ctx, user, newBet);
  });

  bot.action('taunt_pvp', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user.balance < TAUNT_COST) return ctx.reply('❌ Not Enough Funds for Taunt');
    const taunts = ['You’re going down!', 'Prepare to lose!', 'Too easy!', 'Better luck next time!'];
    ctx.session.taunt = taunts[Math.floor(Math.random() * taunts.length)];
    await cleanUpMessage(ctx, currentMessageId);
    await playPvP(ctx);
  });

  bot.action('hype_pvp', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user.balance < HYPE_FEE) return ctx.reply('❌ Not Enough Funds for Hype');
    user.balance -= HYPE_FEE;
    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    admin.balance += HYPE_FEE;
    await user.save();
    await admin.save();
    const allUsers = await User.find({});
    for (const u of allUsers) {
      await ctx.telegram.sendMessage(u.telegramId, `📣 Crowd Hype! ${user.username} is on fire!`).catch(() => {});
    }
    await ctx.reply(`📣 Hype Sent! Your victory echoes across the game!`);
  });

  bot.action(/revenge_pvp_(\d+)_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const opponentId = parseInt(ctx.match[1], 10);
    const betAmount = parseInt(ctx.match[2], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (user.balance < REVENGE_FEE + betAmount + Math.floor(betAmount * ANTE_FEE_RATE)) return ctx.reply('❌ Not Enough Funds for Revenge');
    const opponent = await User.findOne({ telegramId: opponentId });
    if (!opponent || activeGames.has(opponentId)) return ctx.reply('❌ Opponent Unavailable');
    user.balance -= REVENGE_FEE;
    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    admin.balance += REVENGE_FEE;
    await user.save();
    await admin.save();
    await cleanUpMessage(ctx, currentMessageId);
    await startPvPGame(ctx, user, opponent, betAmount, matchmaking);
  });

  bot.action('play_pvp', async (ctx) => {
    await ctx.answerCbQuery();
    await cleanUpMessage(ctx, currentMessageId);
    await playPvP(ctx);
  });

  bot.action('show_leaderboard', async (ctx) => {
    await ctx.answerCbQuery();
    await cleanUpMessage(ctx, currentMessageId);
    await import('../play/leaderboard.js').then(module => module.default(ctx));
  });
};

export default playPvP;
export { pvpHandlers };