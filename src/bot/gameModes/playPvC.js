import User from '../../models/User.js';
import Game from '../../models/Game.js';
import settings from '../../config/settings.js';
import { v4 as uuidv4 } from 'uuid';

// Constants
const MIN_BET = 1; // $1
const MAX_BET = 10; // $10
const BASE_COOLDOWN = 60 * 1000; // 60s
const LUCKY_ROLL_MULTIPLIER = 1.25;
const BOT_LUCKY_PENALTY = 0.6;
const STALE_TIMEOUT = 15 * 1000; // Reduced to 15s for decay
const DAILY_BET_LIMIT = 100;
const DAILY_WIN_CAP = 50;
const MIN_BALANCE_RESERVE = 5;
const DECAY_RATE = 0.20; // 20% decay
const BOT_PERSONALITY_SWITCH_FEE = 1; // $1
const REVERSE_JACKPOT_AMOUNT = 10; // $10
const REVERSE_JACKPOT_CONTRIBUTION = 0.10; // $0.10 per loss

// Power-Up Costs and Effects (Only Boost)
const POWERUP_COSTS = {
  boost: 0.30, // 30%
};
const POWERUP_EFFECTS = {
  boostMultiplier: 1.25,
};

// Risk Ladder Tiers
const RISK_LADDER_TIERS = {
  bronze: { minBet: 1, maxBet: 3, multiplier: 1.2 },
  silver: { minBet: 4, maxBet: 7, multiplier: 1.3, requiredWins: 1 },
  gold: { minBet: 8, maxBet: 10, multiplier: 1.5, requiredWins: 2 },
};

// Bot Personalities (Weekly rotation)
const BOT_PERSONALITIES = {
  greedy: { commissionBonus: 0.25 }, // 25% commission
  tricky: { rerollOnTie: true }, // Reroll if tied
  lucky: { rollBonusChance: 0.20 }, // 20% chance +1
};

// State tracking
const lastGameTime = new Map();
const activeGames = new Set();
const dailyBets = new Map();
const dailyWins = new Map();
const powerUpUsage = new Map();
const riskLadderProgress = new Map(); // UserID -> { tier, wins }
let currentBotPersonality = 'greedy'; // Default, changes weekly
let reverseJackpotPool = 0; // Global pool
let lastBotRoll = null; // Track for Reverse Jackpot
let betPromptMessageId = null;
const timeouts = new Map();

// Log errors
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) ctx.reply(`⚠️ **Error**: ${error.message}`);
};

// Rotate bot personality weekly
const rotateBotPersonality = () => {
  const personalities = Object.keys(BOT_PERSONALITIES);
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  currentBotPersonality = personalities[weekNumber % personalities.length];
};
setInterval(rotateBotPersonality, 7 * 24 * 60 * 60 * 1000); // Weekly
rotateBotPersonality(); // Initial set

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
    if (isBot) lastBotRoll = diceValue; // Track for Reverse Jackpot
    await ctx.deleteMessage(rollingMsg.message_id).catch(() => {});
    return diceValue;
  } catch (error) {
    logError(`rollDice (${isBot ? 'bot' : 'user'})`, error, ctx);
    return null;
  }
};

// Bot roll with adjusted difficulty and personality
const getBotRoll = (difficulty, winStreak) => {
  let roll = Math.floor(Math.random() * 6) + 1;
  if (winStreak >= 3) roll = Math.min(6, roll + 1);
  switch (difficulty) {
    case 'easy': roll = Math.min(5, roll); break;
    case 'normal': if (roll < 4 && Math.random() < 0.1) roll = Math.floor(Math.random() * 6) + 1; break;
    case 'hard': roll = Math.random() < 0.4 ? 6 : roll; break;
  }
  if (currentBotPersonality === 'lucky' && Math.random() < BOT_PERSONALITIES.lucky.rollBonusChance) roll = Math.min(6, roll + 1);
  return roll;
};

// Calculate commission
const getCommissionRate = (betAmount) => {
  const baseRate = betAmount <= 3 ? 0.10 : betAmount <= 7 ? 0.15 : 0.20;
  return currentBotPersonality === 'greedy' ? baseRate + BOT_PERSONALITIES.greedy.commissionBonus : baseRate;
};

// Calculate cooldown
const getCooldownTime = (betAmount) => {
  const scaleFactor = Math.min((betAmount - 1) / 9, 2); // 60s to 180s
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

// Check daily win cap
const checkDailyWinCap = (userId, winAmount) => {
  const today = new Date().toDateString();
  const key = `${userId}-${today}`;
  const current = dailyWins.get(key) || 0;
  if (current + winAmount > DAILY_WIN_CAP) {
    const allowedWin = Math.max(0, DAILY_WIN_CAP - current);
    dailyWins.set(key, DAILY_WIN_CAP);
    return allowedWin;
  }
  dailyWins.set(key, current + winAmount);
  return winAmount;
};

// Prompt for Power-Up selection (Boost only)
const promptPowerUp = async (ctx, user, betAmount) => {
  try {
    const powerUpCount = powerUpUsage.get(user.telegramId) || 0;
    if (powerUpCount >= 1) {
      ctx.session.powerUp = 'none';
      return confirmGame(ctx, user, betAmount);
    }
    const msg = await ctx.replyWithMarkdown(
      `⚡ **Power-Up Option**\n` +
      `🚀 **Boost**: $${Math.floor(betAmount * POWERUP_COSTS.boost)} - 25% extra winnings\n` +
      `➡️ **Skip**: No power-up`,
      {
        reply_markup: {
          inline_keyboard: [
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
        await decayBet(ctx, user, betAmount);
      } catch (e) {}
    }, STALE_TIMEOUT);
    timeouts.set(user.telegramId, timeoutId);

    return msg.message_id;
  } catch (error) {
    logError('promptPowerUp', error, ctx);
  }
};

// Decay bet if timeout occurs
const decayBet = async (ctx, user, betAmount) => {
  try {
    const powerUp = ctx.session?.powerUp || 'none';
    const powerUpCost = powerUp !== 'none' ? Math.floor(betAmount * POWERUP_COSTS[powerUp]) : 0;
    const totalCost = betAmount + powerUpCost;
    const decayAmount = Math.floor(totalCost * DECAY_RATE);
    const decayedBet = totalCost - decayAmount;

    if (user.balance < totalCost + MIN_BALANCE_RESERVE) {
      await ctx.replyWithMarkdown(`❌ **Low Balance**\nNeed $${(totalCost + MIN_BALANCE_RESERVE).toFixed(2)}!`);
      activeGames.delete(user.telegramId);
      timeouts.delete(user.telegramId);
      return;
    }

    user.balance -= decayAmount;
    await user.save();
    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    admin.balance += decayAmount;
    await admin.save();

    await ctx.replyWithMarkdown(`⏰ **Bet Decayed**\n20% ($${decayAmount}) taken. Playing with $${decayedBet}.`);
    await startPvCGame(ctx, user, decayedBet / (1 + (powerUp !== 'none' ? POWERUP_COSTS[powerUp] : 0))); // Adjust bet
  } catch (error) {
    logError('decayBet', error, ctx);
    activeGames.delete(user.telegramId);
    timeouts.delete(user.telegramId);
  }
};

// Confirm game with delay
const confirmGame = async (ctx, user, betAmount) => {
  try {
    const powerUp = ctx.session?.powerUp || 'none';
    const powerUpCost = powerUp !== 'none' ? Math.floor(betAmount * POWERUP_COSTS[powerUp]) : 0;
    const totalCost = betAmount + powerUpCost;

    if (user.balance < totalCost + MIN_BALANCE_RESERVE) {
      await ctx.replyWithMarkdown(`❌ **Low Balance**\nNeed $${(totalCost + MIN_BALANCE_RESERVE).toFixed(2)} (incl. $5 reserve)!`);
      activeGames.delete(user.telegramId);
      return;
    }

    const ladderTier = riskLadderProgress.get(user.telegramId)?.tier || 'bronze';
    const tierInfo = RISK_LADDER_TIERS[ladderTier];
    if (betAmount < tierInfo.minBet || betAmount > tierInfo.maxBet) {
      await ctx.replyWithMarkdown(`❌ **Invalid Bet**\n${ladderTier} tier requires $${tierInfo.minBet}-$${tierInfo.maxBet}!`);
      activeGames.delete(user.telegramId);
      return;
    }

    const msg = await ctx.replyWithMarkdown(
      `🎲 **Confirm Bet**\n` +
      `💰 **Bet**: $${betAmount}\n` +
      (powerUp !== 'none' ? `⚡ **Boost**: +$${powerUpCost}\n` : '') +
      `📊 **Total**: $${totalCost}\n` +
      `💼 **Balance**: $${user.balance.toFixed(2)}\n` +
      `🎯 **Mode**: ${ctx.session?.difficulty || 'normal'}\n` +
      `🏆 **Tier**: ${ladderTier}\n\n` +
      `Confirm in 15s or decay:`,
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
        await decayBet(ctx, user, betAmount);
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
      await ctx.replyWithMarkdown('⏳ **Busy**\nFinish your current game!');
      return;
    }
    activeGames.add(user.telegramId);

    if (!checkDailyBetLimit(user.telegramId, betAmount)) {
      await ctx.replyWithMarkdown('❌ **Daily Limit**\n$100 cap reached. Try tomorrow!');
      activeGames.delete(user.telegramId);
      return;
    }

    if (currentTime - lastGame < cooldown) {
      const remaining = Math.ceil((cooldown - (currentTime - lastGame)) / 1000);
      await ctx.replyWithMarkdown(`⏳ **Cooldown**\nWait ${remaining}s!`);
      activeGames.delete(user.telegramId);
      return;
    }
    if (user.lossStreak >= 3 && currentTime - lastGame < 5 * 60 * 1000) {
      const remaining = Math.ceil((5 * 60 * 1000 - (currentTime - lastGame)) / 1000);
      await ctx.replyWithMarkdown(`⏳ **Break**\nAfter 3 losses, wait ${remaining}s!`);
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
    const ladderTier = riskLadderProgress.get(user.telegramId)?.tier || 'bronze';
    const gameMsg = await ctx.replyWithMarkdown(`🎮 **Game On**\n👤 ${user.username} vs 🤖 Bot (${currentBotPersonality})\nID: ${gameId.slice(0, 8)}\n` +
      `🏆 **Tier**: ${ladderTier}` + (powerUp !== 'none' ? `\n⚡ Boost Active` : ''));

    let playerRoll = await rollDice(ctx, false);
    if (playerRoll === null) {
      activeGames.delete(user.telegramId);
      return;
    }

    let botRoll = await rollDice(ctx, true);
    if (botRoll === null) {
      activeGames.delete(user.telegramId);
      return;
    }

    if (currentBotPersonality === 'tricky' && playerRoll === botRoll) {
      botRoll = await rollDice(ctx, true); // Reroll on tie
    }

    let resultMessage;
    let winAmount = 0;
    let commission = 0;
    const commissionRate = getCommissionRate(betAmount);
    const tierMultiplier = RISK_LADDER_TIERS[ladderTier].multiplier;
    const outcome = playerRoll > botRoll ? 'win' : 'loss'; // Ties are losses
    const ladderProgress = riskLadderProgress.get(user.telegramId) || { tier: 'bronze', wins: 0 };

    if (outcome === 'win') {
      winAmount = playerRoll === 6 ? betAmount * LUCKY_ROLL_MULTIPLIER : betAmount * tierMultiplier;
      if (powerUp === 'boost') winAmount *= POWERUP_EFFECTS.boostMultiplier;
      winAmount = Math.min(winAmount, betAmount * 1.5); // Cap at 1.5x
      commission = Math.floor(winAmount * commissionRate);
      const cappedWin = checkDailyWinCap(user.telegramId, winAmount - commission);
      user.balance += cappedWin;
      admin.balance += commission + (winAmount - commission - cappedWin);
      user.wins += 1;
      user.winStreak += 1;
      user.lossStreak = 0;
      ctx.session.winStreak = user.winStreak;
      ladderProgress.wins += 1;
      if (ladderProgress.tier === 'bronze' && ladderProgress.wins >= RISK_LADDER_TIERS.silver.requiredWins) {
        ladderProgress.tier = 'silver';
        ladderProgress.wins = 0;
      } else if (ladderProgress.tier === 'silver' && ladderProgress.wins >= RISK_LADDER_TIERS.gold.requiredWins) {
        ladderProgress.tier = 'gold';
        ladderProgress.wins = 0;
      }
      riskLadderProgress.set(user.telegramId, ladderProgress);
      resultMessage = playerRoll === 6
        ? `🎉 **Lucky 6!**\n1.25x Bonus!\n`
        : `🎉 **You Win!**\n`;
    } else {
      const botWin = botRoll === 6 ? Math.floor(betAmount * BOT_LUCKY_PENALTY) : betAmount;
      admin.balance += botWin;
      user.losses += 1;
      user.lossStreak += 1;
      user.winStreak = 0;
      ctx.session.winStreak = 0;
      ladderProgress.tier = 'bronze';
      ladderProgress.wins = 0;
      riskLadderProgress.set(user.telegramId, ladderProgress);
      reverseJackpotPool += REVERSE_JACKPOT_CONTRIBUTION;
      if (lastBotRoll === 6 && botRoll === 6 && reverseJackpotPool >= REVERSE_JACKPOT_AMOUNT) {
        admin.balance += REVERSE_JACKPOT_AMOUNT;
        reverseJackpotPool -= REVERSE_JACKPOT_AMOUNT;
        await ctx.replyWithMarkdown(`🎰 **Reverse Jackpot!**\nBot rolled two 6s! House claims $10.`);
      }
      resultMessage = botRoll === 6
        ? `🤖 **Bot’s Lucky 6!**\nTakes 60%!\n`
        : playerRoll === botRoll
        ? `🤝 **Tie = Loss!**\n`
        : `🤖 **Bot Wins!**\n`;
    }

    user.gamesPlayed += 1;
    if (user.gamesPlayed % 5 === 0) {
      await ctx.replyWithMarkdown(`⚠️ **Break?**\n${user.gamesPlayed} games played!`);
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
      ladderTier,
    });
    await game.save();

    resultMessage += `🎲 **Rolls**: You ${playerRoll} | Bot ${botRoll}\n` +
      (outcome === 'win' ? `💰 **Won**: $${(winAmount - commission).toFixed(2)} (after $${commission} fee)\n` +
        (playerRoll === 6 ? `🤖 "Nice roll!"` : `🤖 "Next time!"`)
      : `💸 **Lost**: $${betAmount.toFixed(2)}\n🤖 "Got you!"`) +
      `\n💼 **Balance**: $${user.balance.toFixed(2)}` +
      `\n🏆 **Tier**: ${ladderProgress.tier}` +
      (user.winStreak > 1 ? `\n🔥 **Streak**: ${user.winStreak} wins` : user.lossStreak > 1 ? `\n💀 **Streak**: ${user.lossStreak} losses` : '');

    const resultMsg = await ctx.replyWithMarkdown(resultMessage, {
      reply_markup: {
        inline_keyboard: outcome === 'win' && !dailyWins.get(`${user.telegramId}-${new Date().toDateString()}`) >= DAILY_WIN_CAP
          ? [
              [
                { text: '🎰 Double It', callback_data: `double_${winAmount - commission}_${gameId}` },
                { text: '🎲 Again', callback_data: 'play_pvc' },
              ],
              [
                { text: '🤖 Switch Bot ($1)', callback_data: 'switch_personality' },
              ],
            ]
          : [
              [
                { text: '🎲 Again', callback_data: 'play_pvc' },
                { text: '🤖 Switch Bot ($1)', callback_data: 'switch_personality' },
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

// Double or Nothing (Restricted)
const doubleOrNothing = async (ctx, user, previousWin, gameId) => {
  try {
    activeGames.add(user.telegramId);
    const doubleMsg = await ctx.replyWithMarkdown(`🎰 **Double or Nothing**\nRisk $${previousWin.toFixed(2)}!`);
    const playerRoll = await rollDice(ctx, false);
    if (playerRoll === null) {
      activeGames.delete(user.telegramId); return;
    }

    let botRoll = await rollDice(ctx, true);
    if (botRoll === null) {
      activeGames.delete(user.telegramId); return;
    }
    if (currentBotPersonality === 'tricky' && playerRoll === botRoll) {
      botRoll = await rollDice(ctx, true); // Reroll on tie
    }

    let resultMessage;
    let newWin = 0;
    const outcome = playerRoll > botRoll ? 'win' : 'loss';

    if (outcome === 'win') {
      newWin = previousWin * 1.5;
      newWin = checkDailyWinCap(user.telegramId, newWin);
      user.balance += newWin;
      user.wins += 1;
      user.winStreak += 1;
      user.lossStreak = 0;
      resultMessage = `🎉 **Doubled!**\n` +
        `🎲 **Rolls**: You ${playerRoll} | Bot ${botRoll}\n` +
        `💰 **Won**: $${newWin.toFixed(2)}\n` +
        `🤖 "Well done!"`;
    } else {
      resultMessage = `💥 **Lost!**\n` +
        `🎲 **Rolls**: You ${playerRoll} | Bot ${botRoll}\n` +
        `💸 **Gone**: $${previousWin.toFixed(2)}\n` +
        `🤖 "Tough luck!"`;
      user.losses += 1;
      user.lossStreak += 1;
      user.winStreak = 0;
    }

    user.gamesPlayed += 1;
    await user.save();

    const doubleGame = new Game({
      gameId: uuidv4(),
      userId: user.telegramId,
      betAmount: previousWin,
      playerRoll,
      botRoll,
      outcome,
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
            { text: '🤖 Switch Bot ($1)', callback_data: 'switch_personality' },
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

// Switch bot personality
const switchBotPersonality = async (ctx, user) => {
  try {
    if (user.balance < BOT_PERSONALITY_SWITCH_FEE + MIN_BALANCE_RESERVE) {
      await ctx.replyWithMarkdown(`❌ **Low Balance**\nNeed $${(BOT_PERSONALITY_SWITCH_FEE + MIN_BALANCE_RESERVE).toFixed(2)} to switch!`);
      return;
    }

    user.balance -= BOT_PERSONALITY_SWITCH_FEE;
    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    admin.balance += BOT_PERSONALITY_SWITCH_FEE;
    await user.save();
    await admin.save();

    const personalities = Object.keys(BOT_PERSONALITIES).filter(p => p !== currentBotPersonality);
    currentBotPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    await ctx.replyWithMarkdown(`🤖 **Bot Switched!**\nNow facing: ${currentBotPersonality}`);
  } catch (error) {
    logError('switchBotPersonality', error, ctx);
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

    const ladderTier = riskLadderProgress.get(telegramId)?.tier || 'bronze';
    await ctx.replyWithMarkdown(
      `🎲 **Dice Duel**\n🤖 Bot: ${currentBotPersonality}\n🏆 Tier: ${ladderTier}\n` +
      `Pick your mode:\n` +
      `😊 **Easy**: Bot 1-5 (1.2x)\n` +
      `😐 **Normal**: Slight bias (1.3x)\n` +
      `😈 **Hard**: 40% chance of 6 (1.5x)`,
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
    const ladderTier = riskLadderProgress.get(ctx.from.id)?.tier || 'bronze';
    const tierInfo = RISK_LADDER_TIERS[ladderTier];
    const promptMsg = await ctx.replyWithMarkdown(
      `💰 **Place Bet**\n` +
      `Mode: ${ctx.session.difficulty}\n` +
      `🏆 ${ladderTier}: $${tierInfo.minBet}-$${tierInfo.maxBet}\n` +
      `Type amount (e.g., ${tierInfo.minBet}):`,
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

    const ladderTier = riskLadderProgress.get(user.telegramId)?.tier || 'bronze';
    const tierInfo = RISK_LADDER_TIERS[ladderTier];
    if (betAmount < tierInfo.minBet || betAmount > tierInfo.maxBet) {
      await ctx.replyWithMarkdown(`❌ **Invalid Bet**\n${ladderTier} tier: $${tierInfo.minBet}-$${tierInfo.maxBet}!`);
      return;
    }

    await promptPowerUp(ctx, user, betAmount);
    await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    await ctx.deleteMessage(betPromptMessageId).catch(() => {});
    betPromptMessageId = null;
  });

  bot.action(/powerup_boost_(\d+\.?\d*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseFloat(ctx.match[1]);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    
    ctx.session.powerUp = 'boost';
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
    await new Promise((resolve) => setTimeout(resolve, 3000));
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

  bot.action('switch_personality', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
    await switchBotPersonality(ctx, user);
  });

  bot.action('play_pvc', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await exports.default(ctx);
  });
};