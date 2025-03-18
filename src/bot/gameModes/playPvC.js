import User from '../../models/User.js';
import Game from '../../models/Game.js';
import settings from '../../config/settings.js';
import { v4 as uuidv4 } from 'uuid';

// Constants
const MIN_BET = 1; // $1
const MAX_BET = 10; // $10
const BASE_COOLDOWN = 30 * 1000;
const LUCKY_ROLL_MULTIPLIER = 1.5;
const BOT_LUCKY_PENALTY = 0.6;
const STALE_TIMEOUT = 30 * 1000;
const JACKPOT_CHANCE = 0.005;
const JACKPOT_MULTIPLIER = 10;
const JACKPOT_CAP = 50;
const DAILY_BET_LIMIT = 100;
const MIN_BALANCE_RESERVE = 2;

// Power-Up Costs and Effects
const POWERUP_COSTS = {
  reroll: 0.20, // 20%
  shield: 0.25, // 25%
  boost: 0.30, // 30%
};
const POWERUP_EFFECTS = {
  boostMultiplier: 1.25,
  shieldReduction: 0.5,
};

// State tracking
const lastGameTime = new Map();
const activeGames = new Set();
const dailyBets = new Map();
const powerUpUsage = new Map();
const lossRecoveryPool = { amount: 0 };
let betPromptMessageId = null;
const timeouts = new Map();

// Log errors
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) ctx.reply(`⚠️ **Error**: ${error.message}`);
};

// Roll dice with countdown animation
const rollDice = async (ctx, isBot = false) => {
  try {
    const rollingMsg = await ctx.reply(isBot ? '🤖 **Bot Rolling** 🎲\n3...' : '🎲 **Your Roll**\n3...');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.editMessageText(isBot ? '🤖 **Bot Rolling** 🎲\n2...' : '🎲 **Your Roll**\n2...', { message_id: rollingMsg.message_id });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.editMessageText(isBot ? '🤖 **Bot Rolling** 🎲\n1...' : '🎲 **Your Roll**\n1...', { message_id: rollingMsg.message_id });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const diceValue = isBot ? getBotRoll(ctx.session?.difficulty || 'normal', ctx.session?.winStreak || 0) : (await ctx.replyWithDice()).dice.value;
    await ctx.deleteMessage(rollingMsg.message_id).catch(() => {});
    return diceValue;
  } catch (error) {
    logError(`rollDice (${isBot ? 'bot' : 'user'})`, error, ctx);
    return null;
  }
};

// Bot roll with dynamic difficulty and streak breaker
const getBotRoll = (difficulty, winStreak) => {
  let roll = Math.floor(Math.random() * 6) + 1;
  if (winStreak >= 3) roll = Math.min(6, roll + 1); // Streak breaker
  switch (difficulty) {
    case 'easy': return Math.min(4, roll); // 1-4
    case 'hard': return [1, 2, 3, 4, 5, 6, 6][Math.floor(Math.random() * 7)]; // Bias toward 6
    default: return roll; // Normal
  }
};

// Calculate commission
const getCommissionRate = (betAmount) => {
  return betAmount <= 5 ? 0.05 : 0.10; // 5% for $1-$5, 10% for $6-$10
};

// Calculate cooldown
const getCooldownTime = (betAmount) => {
  const scaleFactor = Math.min((betAmount - 1) / 9, 3); // 30s to 120s
  return BASE_COOLDOWN * (1 + scaleFactor);
};

// Check daily bet limit
const checkDailyBetLimit = (userId, betAmount) => {
  const today = new Date().toDateString();
  const key = `${userId}-${today}`;
  const current = dailyBets.get(key) || 0;
  if (current + betAmount > DAILY_BET_LIMIT) return false;
  dailyBets.set(key, current + betAmount);
  return true;
};

// Prompt for Power-Up selection
const promptPowerUp = async (ctx, user, betAmount) => {
  try {
    const powerUpCount = powerUpUsage.get(user.telegramId) || 0;
    if (powerUpCount >= 1) {
      ctx.session.powerUp = 'none';
      return confirmGame(ctx, user, betAmount);
    }
    const msg = await ctx.replyWithMarkdown(
      `⚡ **Pick a Power-Up** (Optional)\n` +
      `1. 🔄 **Re-Roll**: $${Math.floor(betAmount * POWERUP_COSTS.reroll)} - Roll again\n` +
      `2. 🛡️ **Shield**: $${Math.floor(betAmount * POWERUP_COSTS.shield)} - Halve bot wins\n` +
      `3. 🚀 **Boost**: $${Math.floor(betAmount * POWERUP_COSTS.boost)} - 25% extra winnings\n` +
      `4. ➡️ **Skip**: No power-up`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Re-Roll', callback_data: `powerup_reroll_${betAmount}` },
              { text: '🛡️ Shield', callback_data: `powerup_shield_${betAmount}` },
            ],
            [
              { text: '🚀 Boost', callback_data: `powerup_boost_${betAmount}` },
              { text: '➡️ Skip', callback_data: `confirm_pvc_${betAmount}` },
            ],
          ],
        },
      }
    );

    const timeoutId = setTimeout(async () => {
      try {
        await ctx.deleteMessage(msg.message_id);
        await ctx.replyWithMarkdown('⏰ **Timed Out**: Power-up selection cancelled.');
        activeGames.delete(user.telegramId);
        timeouts.delete(user.telegramId);
      } catch (e) {}
    }, STALE_TIMEOUT);
    timeouts.set(user.telegramId, timeoutId);

    return msg.message_id;
  } catch (error) {
    logError('promptPowerUp', error, ctx);
  }
};

// Confirm game with delay
const confirmGame = async (ctx, user, betAmount) => {
  try {
    const powerUp = ctx.session?.powerUp || 'none';
    const powerUpCost = powerUp !== 'none' ? Math.floor(betAmount * POWERUP_COSTS[powerUp]) : 0;
    const totalCost = betAmount + powerUpCost;

    if (user.balance < totalCost + MIN_BALANCE_RESERVE) {
      await ctx.replyWithMarkdown(`❌ **Low Balance**\nYou need $${(totalCost + MIN_BALANCE_RESERVE).toFixed(2)} (incl. $2 reserve)!`);
      activeGames.delete(user.telegramId);
      return;
    }

    const msg = await ctx.replyWithMarkdown(
      `🎲 **Confirm Bet**\n` +
      `💰 **Bet**: $${betAmount}\n` +
      (powerUp !== 'none' ? `⚡ **Power-Up**: ${powerUp} ($${powerUpCost})\n` : '') +
      `📊 **Total**: $${totalCost}\n` +
      `💼 **Balance**: $${user.balance.toFixed(2)}\n` +
      `🎯 **Mode**: ${ctx.session?.difficulty || 'normal'}\n\n` +
      `Confirm in 3s or cancel:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Play', callback_data: `start_pvc_${betAmount}` },
              { text: '❌ Cancel', callback_data: 'cancel_pvc' },
            ],
          ],
        },
      }
    );

    const timeoutId = setTimeout(async () => {
      try {
        await ctx.deleteMessage(msg.message_id);
        await ctx.replyWithMarkdown('⏰ **Timed Out**: Game cancelled.');
        activeGames.delete(user.telegramId);
        timeouts.delete(user.telegramId);
      } catch (e) {}
    }, STALE_TIMEOUT);
    timeouts.set(user.telegramId, timeoutId);

    return msg.message_id;
  } catch (error) {
    logError('confirmGame', error, ctx);
  }
};

// Start PvC game
const startPvCGame = async (ctx, user, betAmount) => {
  try {
    const currentTime = Date.now();
    const lastGame = lastGameTime.get(user.telegramId) || 0;
    const cooldown = getCooldownTime(betAmount);

    if (activeGames.has(user.telegramId)) {
      await ctx.replyWithMarkdown('⏳ **Busy**\nFinish your current game first!');
      return;
    }
    activeGames.add(user.telegramId);

    if (!checkDailyBetLimit(user.telegramId, betAmount)) {
      await ctx.replyWithMarkdown('❌ **Daily Limit**\nYou’ve hit $50 today. Back tomorrow!');
      activeGames.delete(user.telegramId);
      return;
    }

    if (currentTime - lastGame < cooldown) {
      const remaining = Math.ceil((cooldown - (currentTime - lastGame)) / 1000);
      await ctx.replyWithMarkdown(`⏳ **Cooldown**\nWait ${remaining}s to play again!`);
      activeGames.delete(user.telegramId);
      return;
    }
    if (user.lossStreak >= 3 && currentTime - lastGame < 5 * 60 * 1000) {
      const remaining = Math.ceil((5 * 60 * 1000 - (currentTime - lastGame)) / 1000);
      await ctx.replyWithMarkdown(`⏳ **Break Time**\nAfter 3 losses, wait ${remaining}s!`);
      activeGames.delete(user.telegramId);
      return;
    }
    lastGameTime.set(user.telegramId, currentTime);

    const powerUp = ctx.session?.powerUp || 'none';
    const powerUpCost = powerUp !== 'none' ? Math.floor(betAmount * POWERUP_COSTS[powerUp]) : 0;
    const totalCost = betAmount + powerUpCost;

    if (user.balance < totalCost + MIN_BALANCE_RESERVE) {
      await ctx.replyWithMarkdown(`❌ **Low Balance**\nNeed $${(totalCost + MIN_BALANCE_RESERVE).toFixed(2)}!`);
      activeGames.delete(user.telegramId);
      return;
    }

    user.balance -= totalCost;
    await user.save();

    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    if (!admin) {
      await ctx.replyWithMarkdown('❌ **Error**\nAdmin not found. Contact support.');
      activeGames.delete(user.telegramId);
      return;
    }

    const timeoutId = timeouts.get(user.telegramId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(user.telegramId);
    }

    const gameId = uuidv4();
    const gameMsg = await ctx.replyWithMarkdown(`🎮 **Game Started**\n👤 ${user.username} vs 🤖 Bot\nID: ${gameId.slice(0, 8)}` +
      (powerUp !== 'none' ? `\n⚡ Using: ${powerUp}` : ''));

    let playerRoll = await rollDice(ctx, false);
    if (playerRoll === null) {
      activeGames.delete(user.telegramId);
      return;
    }

    if (powerUp === 'reroll') {
      const rerollMsg = await ctx.replyWithMarkdown(`🔄 **Re-Roll Option**\nRoll: ${playerRoll}\nKeep or try again?`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Keep', callback_data: 'keep_roll' },
              { text: '🔄 Re-Roll', callback_data: 'reroll' },
            ],
          ],
        },
      });
      const rerollResponse = await new Promise((resolve) => {
        bot.once('callback_query', (query) => {
          if (query.from.id === user.telegramId) resolve(query.data);
        });
        setTimeout(() => resolve('keep_roll'), STALE_TIMEOUT);
      });
      await ctx.deleteMessage(rerollMsg.message_id).catch(() => {});
      if (rerollResponse === 'reroll') {
        playerRoll = await rollDice(ctx, false);
        if (playerRoll === null) {
          activeGames.delete(user.telegramId);
          return;
        }
      }
    }

    const botRoll = await rollDice(ctx, true);
    if (botRoll === null) {
      activeGames.delete(user.telegramId);
      return;
    }

    let resultMessage;
    let winAmount = 0;
    let commission = 0;
    const commissionRate = getCommissionRate(betAmount);
    const difficultyMultiplier = { easy: 1.5, normal: 1.8, hard: 2 }[ctx.session?.difficulty || 'normal'];
    const outcome = playerRoll > botRoll ? 'win' : botRoll > playerRoll ? 'loss' : 'tie';

    if (outcome === 'win') {
      winAmount = playerRoll === 6 ? betAmount * LUCKY_ROLL_MULTIPLIER : betAmount * difficultyMultiplier;
      if (powerUp === 'boost') winAmount *= POWERUP_EFFECTS.boostMultiplier;
      commission = Math.floor(winAmount * commissionRate);
      user.balance += winAmount - commission;
      admin.balance += commission;
      user.wins += 1;
      user.winStreak += 1;
      user.lossStreak = 0;
      ctx.session.winStreak = user.winStreak;
      resultMessage = playerRoll === 6
        ? `🎉 **Lucky 6!**\n1.5x Bonus!\n`
        : `🎉 **You Win!**\n`;
    } else if (outcome === 'loss') {
      const botWin = botRoll === 6 ? Math.floor(betAmount * BOT_LUCKY_PENALTY) : betAmount;
      const adjustedBotWin = powerUp === 'shield' ? Math.floor(botWin * POWERUP_EFFECTS.shieldReduction) : botWin;
      admin.balance += adjustedBotWin;
      lossRecoveryPool.amount += Math.floor(betAmount * 0.1);
      user.losses += 1;
      user.lossStreak += 1;
      user.winStreak = 0;
      ctx.session.winStreak = 0;
      resultMessage = botRoll === 6
        ? `🤖 **Bot’s Lucky 6!**\nTakes ${powerUp === 'shield' ? '30%' : '60%'}!\n`
        : `🤖 **Bot Wins!**\n`;
    } else {
      user.balance += betAmount; // Refund bet only
      user.ties += 1;
      user.winStreak = 0;
      user.lossStreak = 0;
      ctx.session.winStreak = 0;
      resultMessage = `🤝 **Tie!**\n`;
    }

    user.gamesPlayed += 1;
    if (user.gamesPlayed % 5 === 0) {
      await ctx.replyWithMarkdown(`⚠️ **Break Time?**\nYou’ve played ${user.gamesPlayed} games!`);
    }
    if (powerUp !== 'none') powerUpUsage.set(user.telegramId, (powerUpUsage.get(user.telegramId) || 0) + 1);

    await user.save();
    await admin.save();

    const game = new Game({
      gameId,
      userId: user.telegramId,
      betAmount,
      playerRoll,
      botRoll,
      outcome,
      winnings: outcome === 'win' ? winAmount - commission : 0,
      commission,
      difficulty: ctx.session?.difficulty || 'normal',
      powerUp: powerUp !== 'none' ? powerUp : undefined,
    });
    await game.save();

    resultMessage += `🎲 **Rolls**: You ${playerRoll} | Bot ${botRoll}\n` +
      (outcome === 'win' ? `💰 **Won**: $${(winAmount - commission).toFixed(2)} (after $${commission} fee)\n` +
        (playerRoll === 6 ? `🤖 "Lucky shot!"` : `🤖 "I’ll win next time!"`)
      : outcome === 'loss' ? `💸 **Lost**: $${(botRoll === 6 ? Math.floor(betAmount * BOT_LUCKY_PENALTY) : betAmount).toFixed(2)}${powerUp === 'shield' ? ' (Shield helped!)' : ''}\n` +
        `🤖 "Gotcha!"`
      : `💵 **Refund**: $${betAmount.toFixed(2)}\n🤖 "Even match!"`) +
      `\n💼 **Balance**: $${user.balance.toFixed(2)}` +
      (user.winStreak > 1 ? `\n🔥 **Streak**: ${user.winStreak} wins` : user.lossStreak > 1 ? `\n💀 **Streak**: ${user.lossStreak} losses` : '');

    if (user.gamesPlayed % 10 === 0 && outcome !== 'win') {
      user.balance += 0.50;
      await user.save();
      resultMessage += `\n🎁 **Bonus**: +$0.50 for 10 games!`;
    }

    const resultMsg = await ctx.replyWithMarkdown(resultMessage, {
      reply_markup: {
        inline_keyboard: outcome === 'win'
          ? [
              [
                { text: '🎰 Double It', callback_data: `double_${winAmount - commission}_${gameId}` },
                { text: '🎲 Again', callback_data: 'play_pvc' },
              ],
            ]
          : [
              [
                { text: '🎲 Again', callback_data: 'play_pvc' },
              ],
            ],
      },
    });

    await ctx.deleteMessage(gameMsg.message_id).catch(() => {});
    activeGames.delete(user.telegramId);
  } catch (error) {
    logError('startPvCGame', error, ctx);
    activeGames.delete(user.telegramId);
  }
};

// Double or Nothing with Jackpot
const doubleOrNothing = async (ctx, user, previousWin, gameId) => {
  try {
    activeGames.add(user.telegramId);
    const doubleMsg = await ctx.replyWithMarkdown(`🎰 **Double or Nothing**\nRisk $${previousWin.toFixed(2)}!`);
    const playerRoll = await rollDice(ctx, false);
    if (playerRoll === null) {
      activeGames.delete(user.telegramId); return;
    }

    const botRoll = await rollDice(ctx, true);
    if (botRoll === null) {
      activeGames.delete(user.telegramId); return;
    }

    let resultMessage;
    let newWin = 0;
    const isJackpot = playerRoll === 6 && Math.random() < JACKPOT_CHANCE && (await Game.findOne({ gameId })).playerRoll === 6;

    if (isJackpot) {
      newWin = Math.min(previousWin * JACKPOT_MULTIPLIER, JACKPOT_CAP);
      user.balance += newWin;
      resultMessage = `🎰 **JACKPOT!**\nTwo 6s!\n` +
        `🎲 **Rolls**: You ${playerRoll} | Bot ${botRoll}\n` +
        `💰 **Won**: $${newWin.toFixed(2)}\n` +
        `🤖 "Insane luck!"`;
    } else if (playerRoll > botRoll) {
      newWin = previousWin * 2;
      user.balance += previousWin;
      resultMessage = `🎉 **Doubled!**\n` +
        `🎲 **Rolls**: You ${playerRoll} | Bot ${botRoll}\n` +
        `💰 **Won**: $${newWin.toFixed(2)}\n` +
        `🤖 "Well played!"`;
    } else {
      resultMessage = `💥 **Lost!**\n` +
        `🎲 **Rolls**: You ${playerRoll} | Bot ${botRoll}\n` +
        `💸 **Gone**: $${previousWin.toFixed(2)}\n` +
        `🤖 "Tough break!"`;
    }

    user.gamesPlayed += 1;
    if (newWin > 0) {
      user.wins += 1; user.winStreak += 1; user.lossStreak = 0;
    } else {
      user.losses += 1; user.lossStreak += 1; user.winStreak = 0;
    }
    await user.save();

    const doubleGame = new Game({
      gameId: uuidv4(),
      userId: user.telegramId,
      betAmount: previousWin,
      playerRoll,
      botRoll,
      outcome: newWin > 0 ? 'win' : 'loss',
      winnings: newWin,
      difficulty: ctx.session?.difficulty || 'normal',
    });
    await doubleGame.save();

    resultMessage += `\n💼 **Balance**: $${user.balance.toFixed(2)}` +
      (user.winStreak > 1 ? `\n🔥 **Streak**: ${user.winStreak} wins` : user.lossStreak > 1 ? `\n💀 **Streak**: ${user.lossStreak} losses` : '');
    await ctx.editMessageText(resultMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎲 Again', callback_data: 'play_pvc' },
          ],
        ],
      },
    });

    activeGames.delete(user.telegramId);
  } catch (error) {
    logError('doubleOrNothing', error, ctx);
    activeGames.delete(user.telegramId);
  }
};

// Main entry point
export default async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });

    if (!user) {
      return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    }

    await ctx.replyWithMarkdown(
      `🎲 **Dice Duel**\nPick your mode:\n` +
      `😊 **Easy**: Bot rolls 1-4 (1.5x)\n` +
      `😐 **Normal**: Fair rolls (1.8x)\n` +
      `😈 **Hard**: Bot loves 6 (2x)`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '😊 Easy', callback_data: 'difficulty_easy' },
              { text: '😐 Normal', callback_data: 'difficulty_normal' },
            ],
            [
              { text: '😈 Hard', callback_data: 'difficulty_hard' },
            ],
          ],
        },
      }
    );
  } catch (error) {
    logError('playPvC', error, ctx);
  }
};

// PvC-specific handlers
export const pvcHandlers = (bot) => {
  bot.action(/difficulty_(easy|normal|hard)/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.difficulty = ctx.match[1];
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    const promptMsg = await ctx.replyWithMarkdown(
      `💰 **Place Your Bet**\n` +
      `Mode: ${ctx.session.difficulty}\n` +
      `Bet $1 to $10\n` +
      `Type amount (e.g., 5):`,
      { reply_markup: { force_reply: true } }
    );
    betPromptMessageId = promptMsg.message_id;
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    if (!ctx.message.reply_to_message || ctx.message.reply_to_message.message_id !== betPromptMessageId || !text.match(/^\d+(\.\d+)?$/)) {
      return next();
    }

    const betAmount = parseFloat(text);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');

    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      await ctx.replyWithMarkdown(`❌ **Invalid Bet**\nMust be $1 to $10!`);
      return;
    }

    await promptPowerUp(ctx, user, betAmount);
    await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    await ctx.deleteMessage(betPromptMessageId).catch(() => {});
    betPromptMessageId = null;
  });

  bot.action(/powerup_(reroll|shield|boost)_(\d+\.?\d*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const powerUp = ctx.match[1];
    const betAmount = parseFloat(ctx.match[2]);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    
    ctx.session.powerUp = powerUp;
    const timeoutId = timeouts.get(user.telegramId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(user.telegramId);
    }

    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await confirmGame(ctx, user, betAmount);
  });

  bot.action(/confirm_pvc_(\d+\.?\d*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseFloat(ctx.match[1]);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    
    ctx.session.powerUp = 'none';
    const timeoutId = timeouts.get(user.telegramId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(user.telegramId);
    }

    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await confirmGame(ctx, user, betAmount);
  });

  bot.action(/start_pvc_(\d+\.?\d*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseFloat(ctx.match[1]);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    await new Promise((resolve) => setTimeout(resolve, 3000)); // 3s delay
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await startPvCGame(ctx, user, betAmount);
  });

  bot.action('cancel_pvc', async (ctx) => {
    await ctx.answerCbQuery('Cancelled!');
    await ctx.editMessageText('❌ **Cancelled**', { parse_mode: 'Markdown' });
    const timeoutId = timeouts.get(ctx.from.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeouts.delete(ctx.from.id);
    }
    activeGames.delete(ctx.from.id);
  });

  bot.action(/double_(\d+\.?\d*)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const previousWin = parseFloat(ctx.match[1]);
    const gameId = ctx.match[2];
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    await doubleOrNothing(ctx, user, previousWin, gameId);
  });

  bot.action('play_pvc', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await exports.default(ctx);
  });
};