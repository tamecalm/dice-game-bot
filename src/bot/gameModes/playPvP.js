import User from '../../models/User.js';
import Game from '../../models/Game.js'; 
import settings from '../../config/settings.js';
import { v4 as uuidv4 } from 'uuid';
import createMatchmaking from '../../utils/matchmaking.js';

// Constants
const MIN_BET = 100;
const MAX_BET = 3000;
const COOLDOWN_TIME = 125000; // 125 seconds
const STALE_TIMEOUT = 30 * 1000;
const LUCKY_ROLL_MULTIPLIER = 1.5; // Bonus for rolling a 6
const JACKPOT_CHANCE = 0.01; // 1% chance for jackpot on double 6s
const JACKPOT_MULTIPLIER = 10;
const POWERUP_COSTS = {
  reroll: 0.10, // 10% of bet
  shield: 0.15, // 15% of bet
  boost: 0.20, // 20% of bet
};
const POWERUP_EFFECTS = {
  boostMultiplier: 1.25, // 25% extra winnings
  shieldReduction: 0.5,  // 50% reduction in loss
};

// State tracking
const lastGameTime = new Map();
const activeGames = new Set();
const timeouts = new Map(); // For auto-cancel
let betPromptMessageId = null;

// Log errors
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) ctx.reply(`⚠️ Error at ${location}: ${error.message}`);
};

// Roll dice with animation
const rollDiceForPlayer = async (ctx, playerName, isPlayer1 = true) => {
  try {
    const rollingMsg = await ctx.reply(`🎲 **${playerName} rolling...** 3...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.editMessageText(`🎲 **${playerName} rolling...** 2...`, { message_id: rollingMsg.message_id });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.editMessageText(`🎲 **${playerName} rolling...** 1...`, { message_id: rollingMsg.message_id });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const diceMessage = await ctx.replyWithDice();
    const diceValue = diceMessage.dice.value;
    await ctx.deleteMessage(rollingMsg.message_id).catch(() => {});
    setTimeout(() => ctx.deleteMessage(diceMessage.message_id).catch(() => {}), 2000);
    return diceValue;
  } catch (error) {
    logError('rollDiceForPlayer', error, ctx);
    return null;
  }
};

// Calculate commission
const getCommissionRate = (betAmount) => {
  if (betAmount <= 500) return 0.1;
  if (betAmount <= 2000) return 0.3;
  return 0.5;
};

// Prompt Power-Up selection
const promptPowerUp = async (ctx, user, betAmount) => {
  try {
    const msg = await ctx.replyWithMarkdown(
      `⚡ **Choose a Power-Up (Optional)**\n\n` +
      `1. 🔄 Re-Roll (${Math.floor(betAmount * POWERUP_COSTS.reroll)} ${user.currency}): Re-roll your dice once\n` +
      `2. 🛡️ Shield (${Math.floor(betAmount * POWERUP_COSTS.shield)} ${user.currency}): Halve opponent winnings\n` +
      `3. 🚀 Boost (${Math.floor(betAmount * POWERUP_COSTS.boost)} ${user.currency}): +25% winnings\n` +
      `Or skip for no Power-Up.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Re-Roll', callback_data: `powerup_reroll_${betAmount}` },
              { text: '🛡️ Shield', callback_data: `powerup_shield_${betAmount}` },
            ],
            [
              { text: '🚀 Boost', callback_data: `powerup_boost_${betAmount}` },
              { text: '➡️ Skip', callback_data: `confirm_pvp_${betAmount}` },
            ],
          ],
        },
      }
    );

    const timeoutId = setTimeout(async () => {
      try {
        await ctx.deleteMessage(msg.message_id);
        await ctx.replyWithMarkdown('⏰ **Power-Up selection cancelled** due to inactivity.');
        activeGames.delete(user.telegramId);
        timeouts.delete(user.telegramId);
      } catch (e) {}
    }, STALE_TIMEOUT);
    timeouts.set(user.telegramId, timeoutId);

    return msg.message_id;
  } catch (error) {
    logError('promptPowerUpPvP', error, ctx);
  }
};

// Confirm game
const confirmGame = async (ctx, user, betAmount) => {
  try {
    const powerUp = ctx.session?.powerUp || 'none';
    const powerUpCost = powerUp !== 'none' ? Math.floor(betAmount * POWERUP_COSTS[powerUp]) : 0;
    const totalCost = betAmount + powerUpCost;

    if (user.balance < totalCost) {
      await ctx.replyWithMarkdown(`❌ **Insufficient Funds**\nYou need at least ${totalCost} ${user.currency} with Power-Up!`);
      activeGames.delete(user.telegramId);
      return;
    }

    const msg = await ctx.replyWithMarkdown(
      `🎲 **Confirm Your Bet (Vs Player)**\n\n` +
      `💵 **Bet:** ${betAmount} ${user.currency}\n` +
      (powerUp !== 'none' ? `⚡ **Power-Up:** ${powerUp} (${powerUpCost} ${user.currency})\n` : '') +
      `🔹 **Total Cost:** ${totalCost} ${user.currency}\n` +
      `🔹 **Balance:** ${user.balance.toFixed(2)} ${user.currency}\n\n` +
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

    const timeoutId = setTimeout(async () => {
      try {
        await ctx.deleteMessage(msg.message_id);
        await ctx.replyWithMarkdown('⏰ **Game auto-cancelled** due to inactivity.');
        activeGames.delete(user.telegramId);
        timeouts.delete(user.telegramId);
      } catch (e) {}
    }, STALE_TIMEOUT);
    timeouts.set(user.telegramId, timeoutId);

    return msg.message_id;
  } catch (error) {
    logError('confirmGamePvP', error, ctx);
  }
};

// Start PvP game
const startPvPGame = async (ctx, player1, player2, betAmount, matchmaking) => {
  try {
    const currentTime = Date.now();
    const p1Cooldown = lastGameTime.get(player1.telegramId) || 0;
    const p2Cooldown = lastGameTime.get(player2.telegramId) || 0;

    if (activeGames.has(player1.telegramId) || activeGames.has(player2.telegramId)) {
      await ctx.replyWithMarkdown('⏳ **One Game at a Time**\nOne or both players are already in a game!');
      matchmaking.leaveQueue(player1.telegramId);
      matchmaking.leaveQueue(player2.telegramId);
      return;
    }
    activeGames.add(player1.telegramId);
    activeGames.add(player2.telegramId);

    if (currentTime - p1Cooldown < COOLDOWN_TIME || currentTime - p2Cooldown < COOLDOWN_TIME) {
      const remaining = Math.ceil(Math.max(COOLDOWN_TIME - (currentTime - p1Cooldown), COOLDOWN_TIME - (currentTime - p2Cooldown)) / 1000);
      await ctx.replyWithMarkdown(`⏳ **Cooldown Active**\nWait ${remaining}s before playing again!`);
      activeGames.delete(player1.telegramId);
      activeGames.delete(player2.telegramId);
      return;
    }
    lastGameTime.set(player1.telegramId, currentTime);
    lastGameTime.set(player2.telegramId, currentTime);

    const p1PowerUp = ctx.session?.powerUp || 'none';
    const p1PowerUpCost = p1PowerUp !== 'none' ? Math.floor(betAmount * POWERUP_COSTS[p1PowerUp]) : 0;
    const p1TotalCost = betAmount + p1PowerUpCost;
    const p2PowerUp = ctx.session?.opponentPowerUp || 'none'; // Assuming opponent set this in matchmaking
    const p2PowerUpCost = p2PowerUp !== 'none' ? Math.floor(betAmount * POWERUP_COSTS[p2PowerUp]) : 0;
    const p2TotalCost = betAmount + p2PowerUpCost;

    if (player1.balance < p1TotalCost || player2.balance < p2TotalCost) {
      await ctx.replyWithMarkdown(`❌ **Insufficient Funds**\nOne or both players need more ${player1.currency}!`);
      activeGames.delete(player1.telegramId);
      activeGames.delete(player2.telegramId);
      return;
    }

    player1.balance -= p1TotalCost;
    player2.balance -= p2TotalCost;
    await player1.save();
    await player2.save();

    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    if (!admin) {
      await ctx.replyWithMarkdown(`❌ **Admin Error**\nContact support—admin not found.`);
      activeGames.delete(player1.telegramId);
      activeGames.delete(player2.telegramId);
      return;
    }

    const gameId = uuidv4();
    const gameMsg = await ctx.replyWithMarkdown(`🎮 **Match Start!**\n\n👤 **${player1.username}** vs 👤 **${player2.username}**\nGame ID: ${gameId.slice(0, 8)}` +
      (p1PowerUp !== 'none' ? `\n⚡ **${player1.username} Power-Up:** ${p1PowerUp}` : '') +
      (p2PowerUp !== 'none' ? `\n⚡ **${player2.username} Power-Up:** ${p2PowerUp}` : ''));

    let roll1 = await rollDiceForPlayer(ctx, player1.username, true);
    if (roll1 === null) {
      activeGames.delete(player1.telegramId);
      activeGames.delete(player2.telegramId);
      return;
    }

    if (p1PowerUp === 'reroll') {
      const rerollMsg = await ctx.replyWithMarkdown(`🔄 **${player1.username} Re-Roll!**\nRoll: ${roll1}\nKeep or re-roll?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Keep', callback_data: 'keep_roll_p1' },
              { text: '🔄 Re-Roll', callback_data: 'reroll_p1' },
            ],
          ],
        },
      });
      const rerollResponse = await new Promise((resolve) => {
        bot.once('callback_query', (query) => {
          if (query.from.id === player1.telegramId) resolve(query.data);
        });
        setTimeout(() => resolve('keep_roll_p1'), STALE_TIMEOUT);
      });
      await ctx.deleteMessage(rerollMsg.message_id).catch(() => {});
      if (rerollResponse === 'reroll_p1') {
        roll1 = await rollDiceForPlayer(ctx, player1.username, true);
        if (roll1 === null) {
          activeGames.delete(player1.telegramId);
          activeGames.delete(player2.telegramId);
          return;
        }
      }
    }

    let roll2 = await rollDiceForPlayer(ctx, player2.username, false);
    if (roll2 === null) {
      activeGames.delete(player1.telegramId);
      activeGames.delete(player2.telegramId);
      return;
    }

    if (p2PowerUp === 'reroll') {
      const rerollMsg = await ctx.telegram.sendMessage(player2.telegramId, `🔄 **${player2.username} Re-Roll!**\nRoll: ${roll2}\nKeep or re-roll?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Keep', callback_data: 'keep_roll_p2' },
              { text: '🔄 Re-Roll', callback_data: 'reroll_p2' },
            ],
          ],
        },
      });
      const rerollResponse = await new Promise((resolve) => {
        bot.once('callback_query', (query) => {
          if (query.from.id === player2.telegramId) resolve(query.data);
        });
        setTimeout(() => resolve('keep_roll_p2'), STALE_TIMEOUT);
      });
      await ctx.telegram.deleteMessage(player2.telegramId, rerollMsg.message_id).catch(() => {});
      if (rerollResponse === 'reroll_p2') {
        roll2 = await rollDiceForPlayer(ctx, player2.username, false);
        if (roll2 === null) {
          activeGames.delete(player1.telegramId);
          activeGames.delete(player2.telegramId);
          return;
        }
      }
    }

    let resultMessage;
    let winAmount = betAmount * 2;
    const commissionRate = getCommissionRate(betAmount);
    const isJackpot = roll1 === 6 && roll2 === 6 && Math.random() < JACKPOT_CHANCE;

    if (isJackpot) {
      const jackpotAmount = winAmount * JACKPOT_MULTIPLIER;
      const commission = Math.floor(jackpotAmount * commissionRate);
      player1.balance += Math.floor((jackpotAmount - commission) / 2);
      player2.balance += Math.floor((jackpotAmount - commission) / 2);
      admin.balance += commission;
      resultMessage = `🎰 **JACKPOT TIE!**\nDouble 6s hit the jackpot!\n` +
        `👤 ${player1.username}: ${roll1} vs ${player2.username}: ${roll2}\n` +
        `💰 Each wins: ${((jackpotAmount - commission) / 2).toFixed(2)} ${player1.currency} (after ${commission} commission)`;
    } else if (roll1 > roll2) {
      winAmount = roll1 === 6 ? winAmount * LUCKY_ROLL_MULTIPLIER : winAmount;
      if (p1PowerUp === 'boost') winAmount *= POWERUP_EFFECTS.boostMultiplier;
      if (p2PowerUp === 'shield') winAmount = Math.floor(winAmount * (1 - POWERUP_EFFECTS.shieldReduction));
      const commission = Math.floor(winAmount * commissionRate);
      player1.balance += winAmount - commission;
      admin.balance += commission;
      player1.wins += 1;
      player1.winStreak += 1;
      player1.lossStreak = 0;
      player2.losses += 1;
      player2.lossStreak += 1;
      player2.winStreak = 0;
      resultMessage = roll1 === 6
        ? `🎉 **Lucky Roll! ${player1.username} Wins!**\n`
        : `🎉 **${player1.username} Wins!**\n`;
    } else if (roll2 > roll1) {
      winAmount = roll2 === 6 ? winAmount * LUCKY_ROLL_MULTIPLIER : winAmount;
      if (p2PowerUp === 'boost') winAmount *= POWERUP_EFFECTS.boostMultiplier;
      if (p1PowerUp === 'shield') winAmount = Math.floor(winAmount * (1 - POWERUP_EFFECTS.shieldReduction));
      const commission = Math.floor(winAmount * commissionRate);
      player2.balance += winAmount - commission;
      admin.balance += commission;
      player2.wins += 1;
      player2.winStreak += 1;
      player2.lossStreak = 0;
      player1.losses += 1;
      player1.lossStreak += 1;
      player1.winStreak = 0;
      resultMessage = roll2 === 6
        ? `🎉 **Lucky Roll! ${player2.username} Wins!**\n`
        : `🎉 **${player2.username} Wins!**\n`;
    } else {
      player1.balance += betAmount; // Refund bet only
      player2.balance += betAmount; // Refund bet only
      player1.ties += 1;
      player2.ties += 1;
      player1.winStreak = 0;
      player2.winStreak = 0;
      player1.lossStreak = 0;
      player2.lossStreak = 0;
      resultMessage = `🤝 **Tie!**\n`;
    }

    player1.gamesPlayed += 1;
    player2.gamesPlayed += 1;
    await player1.save();
    await player2.save();
    await admin.save();

    const game = new Game({
      gameId,
      userId: player1.telegramId,
      opponentId: player2.telegramId,
      betAmount,
      playerRoll: roll1,
      botRoll: roll2, // Using botRoll field for opponent roll
      outcome: roll1 > roll2 ? 'win' : roll2 > roll1 ? 'loss' : 'tie',
      winnings: roll1 > roll2 ? winAmount - Math.floor(winAmount * commissionRate) : 0,
      commission: Math.floor(winAmount * commissionRate) || 0,
      powerUp: p1PowerUp !== 'none' ? p1PowerUp : undefined,
      opponentPowerUp: p2PowerUp !== 'none' ? p2PowerUp : undefined,
    });
    await game.save();

    resultMessage += `👤 ${player1.username}: ${roll1} vs ${player2.username}: ${roll2}\n` +
      (isJackpot ? ''
      : roll1 > roll2 ? `💰 ${player1.username} Won: ${(winAmount - Math.floor(winAmount * commissionRate)).toFixed(2)} ${player1.currency} (after ${Math.floor(winAmount * commissionRate)} commission)\n`
      : roll2 > roll1 ? `💰 ${player2.username} Won: ${(winAmount - Math.floor(winAmount * commissionRate)).toFixed(2)} ${player2.currency} (after ${Math.floor(winAmount * commissionRate)} commission)\n`
      : `💵 Bets refunded.\n`) +
      `\n🔹 **${player1.username} Balance:** ${player1.balance.toFixed(2)} ${player1.currency}` +
      `\n🔹 **${player2.username} Balance:** ${player2.balance.toFixed(2)} ${player2.currency}` +
      (player1.winStreak > 1 ? `\n🔥 **${player1.username} Win Streak:** ${player1.winStreak}` : player1.lossStreak > 1 ? `\n💀 **${player1.username} Loss Streak:** ${player1.lossStreak}` : '') +
      (player2.winStreak > 1 ? `\n🔥 **${player2.username} Win Streak:** ${player2.winStreak}` : player2.lossStreak > 1 ? `\n💀 **${player2.username} Loss Streak:** ${player2.lossStreak}` : '');

    const inlineKeyboard = [
      [
        { text: '🎲 Play Again', callback_data: 'play_pvp' },
        { text: '📊 Stats', callback_data: 'stats_pvp' },
      ],
    ];
    if (roll1 > roll2 || roll2 > roll1) {
      inlineKeyboard.unshift([
        { text: '🎰 Double or Nothing', callback_data: `double_pvp_${(winAmount - Math.floor(winAmount * commissionRate)).toFixed(2)}_${gameId}` },
      ]);
    }

    await ctx.replyWithMarkdown(resultMessage, { reply_markup: { inline_keyboard: inlineKeyboard } });
    await ctx.deleteMessage(gameMsg.message_id).catch(() => {});

    [player1, player2].forEach(async (player) => {
      await ctx.telegram.sendMessage(player.telegramId, resultMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard },
      }).catch((err) => logError('notifyPlayerPvP', err));
    });

    activeGames.delete(player1.telegramId);
    activeGames.delete(player2.telegramId);
  } catch (error) {
    logError('startPvPGame', error, ctx);
    activeGames.delete(player1.telegramId);
    activeGames.delete(player2.telegramId);
  }
};

// Double or Nothing
const doubleOrNothingPvP = async (ctx, user, opponent, previousWin, gameId) => {
  try {
    activeGames.add(user.telegramId);
    activeGames.add(opponent.telegramId);
    const doubleMsg = await ctx.replyWithMarkdown(`🎰 **Double or Nothing!**\n\n${user.username} vs ${opponent.username}\nRisk: ${previousWin.toFixed(2)} ${user.currency}`);
    
    const roll1 = await rollDiceForPlayer(ctx, user.username, true);
    if (roll1 === null) {
      activeGames.delete(user.telegramId);
      activeGames.delete(opponent.telegramId);
      return;
    }

    const roll2 = await rollDiceForPlayer(ctx, opponent.username, false);
    if (roll2 === null) {
      activeGames.delete(user.telegramId);
      activeGames.delete(opponent.telegramId);
      return;
    }

    let resultMessage;
    let newWin = 0;

    if (roll1 > roll2) {
      newWin = previousWin * 2;
      user.balance += newWin;
      resultMessage = `🎉 **${user.username} Wins Double!**\n` +
        `👤 ${user.username}: ${roll1} vs ${opponent.username}: ${roll2}\n` +
        `💰 Won: ${newWin.toFixed(2)} ${user.currency}`;
      user.wins += 1;
      user.winStreak += 1;
      user.lossStreak = 0;
      opponent.losses += 1;
      opponent.lossStreak += 1;
      opponent.winStreak = 0;
    } else if (roll2 > roll1) {
      newWin = previousWin * 2;
      opponent.balance += newWin;
      resultMessage = `🎉 **${opponent.username} Wins Double!**\n` +
        `👤 ${user.username}: ${roll1} vs ${opponent.username}: ${roll2}\n` +
        `💰 Won: ${newWin.toFixed(2)} ${opponent.currency}`;
      opponent.wins += 1;
      opponent.winStreak += 1;
      opponent.lossStreak = 0;
      user.losses += 1;
      user.lossStreak += 1;
      user.winStreak = 0;
    } else {
      resultMessage = `🤝 **Tie!**\n` +
        `👤 ${user.username}: ${roll1} vs ${opponent.username}: ${roll2}\n` +
        `💸 No change in balance.`;
      user.ties += 1;
      opponent.ties += 1;
    }

    user.gamesPlayed += 1;
    opponent.gamesPlayed += 1;
    await user.save();
    await opponent.save();

    const doubleGame = new Game({
      gameId: uuidv4(),
      userId: user.telegramId,
      opponentId: opponent.telegramId,
      betAmount: previousWin,
      playerRoll: roll1,
      botRoll: roll2,
      outcome: roll1 > roll2 ? 'win' : roll2 > roll1 ? 'loss' : 'tie',
      winnings: roll1 > roll2 ? newWin : 0,
    });
    await doubleGame.save();

    resultMessage += `\n🔹 **${user.username} Balance:** ${user.balance.toFixed(2)} ${user.currency}` +
      `\n🔹 **${opponent.username} Balance:** ${opponent.balance.toFixed(2)} ${opponent.currency}`;

    await ctx.editMessageText(resultMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎲 Play Again', callback_data: 'play_pvp' },
            { text: '📊 Stats', callback_data: 'stats_pvp' },
          ],
        ],
      },
    });

    [user, opponent].forEach(async (player) => {
      await ctx.telegram.sendMessage(player.telegramId, resultMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎲 Play Again', callback_data: 'play_pvp' },
              { text: '📊 Stats', callback_data: 'stats_pvp' },
            ],
          ],
        },
      }).catch((err) => logError('notifyDoublePvP', err));
    });

    activeGames.delete(user.telegramId);
    activeGames.delete(opponent.telegramId);
  } catch (error) {
    logError('doubleOrNothingPvP', error, ctx);
    activeGames.delete(user.telegramId);
    activeGames.delete(opponent.telegramId);
  }
};

// Main entry point
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
      `🎲 **Play Vs Player**\n\nChoose your bet amount:`,
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
    await promptPowerUp(ctx, user, betAmount);
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
  });

  bot.action(/powerup_(reroll|shield|boost)_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const powerUp = ctx.match[1];
    const betAmount = parseInt(ctx.match[2], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    
    ctx.session.powerUp = powerUp;
    const timeoutId = timeouts.get(user.telegramId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(user.telegramId);
    }

    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await confirmGame(ctx, user, betAmount);
  });

  bot.action(/confirm_pvp_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    
    ctx.session.powerUp = 'none';
    const timeoutId = timeouts.get(user.telegramId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(user.telegramId);
    }

    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await confirmGame(ctx, user, betAmount);
  });

  bot.action(/queue_pvp_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
  
    const timeoutId = timeouts.get(user.telegramId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(user.telegramId);
    }
  
    const player = {
      telegramId,
      username: user.username,
      betAmount,
      powerUp: ctx.session?.powerUp || 'none',
      currency: user.currency, // Pass currency for notifications
    };
    const result = matchmaking.joinQueue(player);
  
    if (!result.success) {
      await ctx.replyWithMarkdown(`❌ **Error**\n${result.message}`);
      return;
    }
  
    if (result.match) {
      const [player1Data, player2Data] = result.match;
      const player1 = await User.findOne({ telegramId: player1Data.telegramId });
      const player2 = await User.findOne({ telegramId: player2Data.telegramId });
      ctx.session.opponentPowerUp = player2Data.powerUp;
      await startPvPGame(ctx, player1, player2, betAmount, matchmaking);
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
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
  });
  
  bot.action('cancel_pvp', async (ctx) => {
    await ctx.answerCbQuery('Game canceled.');
    const userId = ctx.from.id;
    const result = matchmaking.leaveQueue(userId);
    if (!result.success) {
      logError('cancel_pvp', new Error('Player not in queue'), ctx);
    }
    const timeoutId = timeouts.get(userId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(userId);
    }
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await ctx.replyWithMarkdown('❌ **Game Cancelled**\nYou’ve left the queue.');
    activeGames.delete(userId);
  });
  
  bot.action(/double_pvp_(\d+\.?\d*)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const previousWin = parseFloat(ctx.match[1]);
    const gameId = ctx.match[2];
    const user = await User.findOne({ telegramId: ctx.from.id });
    const game = await Game.findOne({ gameId });
    const opponent = await User.findOne({ telegramId: game.opponentId });
    if (!user || !opponent) return ctx.replyWithMarkdown('❌ **Error**\nPlayer not found.');
    await doubleOrNothingPvP(ctx, user, opponent, previousWin, gameId);
  });

  bot.action('play_pvp', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await exports.default(ctx);
  });

  bot.action('stats_pvp', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    const games = await Game.find({ $or: [{ userId: user.telegramId }, { opponentId: user.telegramId }] }).sort({ timestamp: -1 }).limit(5);
    const statsMsg = `📊 **Your PvP Stats**\n\n` +
      `🎮 Games Played: ${user.gamesPlayed}\n` +
      `✅ Wins: ${user.wins}\n` +
      `❌ Losses: ${user.losses}\n` +
      `🤝 Ties: ${user.ties}\n` +
      `🔥 Win Streak: ${user.winStreak}\n` +
      `💀 Loss Streak: ${user.lossStreak}\n\n` +
      `**Recent Games:**\n` +
      (games.map(g => {
        const isUserWinner = (g.userId === user.telegramId && g.outcome === 'win') || (g.opponentId === user.telegramId && g.outcome === 'loss');
        return `${g.timestamp.toLocaleDateString()} - ${isUserWinner ? 'WIN' : g.outcome === 'tie' ? 'TIE' : 'LOSS'} (${g.betAmount} ${user.currency})${g.powerUp ? ` [${g.powerUp}]` : ''}`;
      }).join('\n') || 'No recent games.');
    await ctx.replyWithMarkdown(statsMsg);
  });
};