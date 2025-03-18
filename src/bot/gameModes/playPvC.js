import User from '../../models/User.js';
import Game from '../../models/Game.js'; // New model
import settings from '../../config/settings.js';
import { v4 as uuidv4 } from 'uuid'; // Install: npm install uuid

// Constants
const MIN_BET = 100;
const MAX_BET = 5000;
const BASE_COOLDOWN = 60 * 1000;
const LUCKY_ROLL_MULTIPLIER = 1.5;
const BOT_LUCKY_PENALTY = 0.6;
const STALE_TIMEOUT = 30 * 1000;
const JACKPOT_CHANCE = 0.01; // 1% chance
const JACKPOT_MULTIPLIER = 10;

// State tracking
const lastGameTime = new Map();
const activeGames = new Set(); // Prevent concurrent games
let betPromptMessageId = null;

// Log errors
const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) ctx.reply(`⚠️ Error at ${location}: ${error.message}`);
};

// Roll dice with countdown animation
const rollDice = async (ctx, isBot = false) => {
  try {
    const rollingMsg = await ctx.reply(isBot ? '🤖 **Bot rolling...** 🎲 3...' : '🎲 **Rolling...** 3...');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.editMessageText(isBot ? '🤖 **Bot rolling...** 🎲 2...' : '🎲 **Rolling...** 2...', { message_id: rollingMsg.message_id });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.editMessageText(isBot ? '🤖 **Bot rolling...** 🎲 1...' : '🎲 **Rolling...** 1...', { message_id: rollingMsg.message_id });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const diceValue = isBot ? getBotRoll(ctx.session.difficulty || 'normal') : (await ctx.replyWithDice()).dice.value;
    await ctx.deleteMessage(rollingMsg.message_id).catch(() => {});
    return diceValue;
  } catch (error) {
    logError(`rollDice (${isBot ? 'bot' : 'user'})`, error, ctx);
    return null;
  }
};

// Bot roll with dynamic difficulty
const getBotRoll = (difficulty) => {
  switch (difficulty) {
    case 'easy': return Math.floor(Math.random() * 4) + 1; // 1-4
    case 'hard': return [1, 2, 3, 4, 5, 6, 6][Math.floor(Math.random() * 7)]; // Bias toward 6
    default: return Math.floor(Math.random() * 6) + 1; // Normal
  }
};

// Calculate commission
const getCommissionRate = (betAmount) => {
  if (betAmount <= 500) return 0.1;
  if (betAmount <= 2000) return 0.3;
  return 0.5;
};

// Calculate cooldown
const getCooldownTime = (betAmount) => {
  const scaleFactor = Math.min(betAmount / 1000, 3);
  return BASE_COOLDOWN * (1 + scaleFactor);
};

// Confirm game
const confirmGame = async (ctx, user, betAmount) => {
  try {
    const msg = await ctx.replyWithMarkdown(
      `🎲 **Confirm Your Bet (Vs Computer)**\n\n` +
      `💵 **Bet:** ${betAmount} ${user.currency}\n` +
      `🔹 **Balance:** ${user.balance.toFixed(2)} ${user.currency}\n` +
      `🎯 **Difficulty:** ${ctx.session.difficulty || 'normal'}\n\n` +
      `Ready to roll? 🤖`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, Play', callback_data: `start_pvc_${betAmount}` },
              { text: '❌ Cancel', callback_data: 'cancel_pvc' },
            ],
          ],
        },
      }
    );

    setTimeout(async () => {
      try {
        await ctx.deleteMessage(msg.message_id);
        await ctx.replyWithMarkdown('⏰ **Game auto-cancelled** due to inactivity.');
        activeGames.delete(user.telegramId);
      } catch (e) {}
    }, STALE_TIMEOUT);
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
      await ctx.replyWithMarkdown('⏳ **One Game at a Time**\nFinish your current game first!');
      return;
    }
    activeGames.add(user.telegramId);

    if (currentTime - lastGame < cooldown) {
      const remaining = Math.ceil((cooldown - (currentTime - lastGame)) / 1000);
      await ctx.replyWithMarkdown(`⏳ **Cooldown Active**\nWait ${remaining}s before playing again!`);
      activeGames.delete(user.telegramId);
      return;
    }
    lastGameTime.set(user.telegramId, currentTime);

    if (user.balance < betAmount) {
      await ctx.replyWithMarkdown(`❌ **Insufficient Funds**\nYou need at least ${betAmount} ${user.currency}!`);
      activeGames.delete(user.telegramId);
      return;
    }

    user.balance -= betAmount;
    await user.save();

    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    if (!admin) {
      await ctx.replyWithMarkdown(`❌ **Admin Error**\nContact support—admin not found.`);
      activeGames.delete(user.telegramId);
      return;
    }

    const gameId = uuidv4();
    const gameMsg = await ctx.replyWithMarkdown(`🎮 **Game On!**\n\n👤 **${user.username}** vs 🤖 **Bot**\nGame ID: ${gameId.slice(0, 8)}`);
    const playerRoll = await rollDice(ctx, false);
    if (playerRoll === null) {
      activeGames.delete(user.telegramId);
      return;
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
    const outcome = playerRoll > botRoll ? 'win' : botRoll > playerRoll ? 'loss' : 'tie';

    if (outcome === 'win') {
      winAmount = playerRoll === 6 ? betAmount * LUCKY_ROLL_MULTIPLIER : betAmount * 2;
      commission = Math.floor(winAmount * commissionRate);
      user.balance += winAmount - commission;
      admin.balance += commission;
      user.wins += 1;
      user.winStreak += 1;
      user.lossStreak = 0;
      resultMessage = playerRoll === 6
        ? `🎉 **Lucky Roll!**\n👤 You rolled a 6! 1.5x bonus!\n`
        : `🎉 **${user.username} Wins!**\n`;
    } else if (outcome === 'loss') {
      admin.balance += botRoll === 6 ? Math.floor(betAmount * BOT_LUCKY_PENALTY) : betAmount;
      user.losses += 1;
      user.lossStreak += 1;
      user.winStreak = 0;
      resultMessage = botRoll === 6
        ? `🤖 **Bot’s Lucky Roll!**\n🤖 Rolled a 6—takes 60%!\n`
        : `🤖 **Bot Wins!**\n`;
    } else {
      user.balance += betAmount;
      user.ties += 1;
      user.winStreak = 0;
      user.lossStreak = 0;
      resultMessage = `🤝 **Tie!**\n`;
    }

    user.gamesPlayed += 1;
    await user.save();
    await admin.save();

    // Save game to database
    const game = new Game({
      gameId,
      userId: user.telegramId,
      betAmount,
      playerRoll,
      botRoll,
      outcome,
      winnings: outcome === 'win' ? winAmount - commission : 0,
      commission,
      difficulty: ctx.session.difficulty || 'normal',
    });
    await game.save();

    resultMessage += `👤 Roll: ${playerRoll} vs 🤖 Roll: ${botRoll}\n` +
      (outcome === 'win' ? `💰 Won: ${(winAmount - commission).toFixed(2)} ${user.currency} (after ${commission} commission)\n` +
        (playerRoll === 6 ? `🤖 "You got lucky this time!"` : `🤖 "I'm programmed to win... but you got me!"`)
      : outcome === 'loss' ? `💸 Lost: ${(botRoll === 6 ? betAmount * BOT_LUCKY_PENALTY : betAmount).toFixed(2)} ${user.currency}\n` +
        `🤖 "Ha! Try again, human!"`
      : `💵 Bet refunded.\n🤖 "Close one!"`) +
      `\n🔹 **New Balance:** ${user.balance.toFixed(2)} ${user.currency}` +
      (user.winStreak > 1 ? `\n🔥 **Win Streak:** ${user.winStreak}` : user.lossStreak > 1 ? `\n💀 **Loss Streak:** ${user.lossStreak}` : '');

    const resultMsg = await ctx.replyWithMarkdown(resultMessage, {
      reply_markup: {
        inline_keyboard: outcome === 'win'
          ? [
              [
                { text: '🎰 Double or Nothing', callback_data: `double_${winAmount - commission}_${gameId}` },
                { text: '🎲 Play Again', callback_data: 'play_pvc' },
                { text: '📊 Stats', callback_data: 'stats' },
              ],
            ]
          : [
              [
                { text: '🎲 Play Again', callback_data: 'play_pvc' },
                { text: '📊 Stats', callback_data: 'stats' },
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
    const doubleMsg = await ctx.replyWithMarkdown(`🎰 **Double or Nothing!**\n\nRisk your ${previousWin.toFixed(2)} ${user.currency} winnings!`);
    const playerRoll = await rollDice(ctx, false);
    if (playerRoll === null) {
      activeGames.delete(user.telegramId);
      return;
    }

    const botRoll = await rollDice(ctx, true);
    if (botRoll === null) {
      activeGames.delete(user.telegramId);
      return;
    }

    let resultMessage;
    let newWin = 0;
    const isJackpot = playerRoll === 6 && Math.random() < JACKPOT_CHANCE && (await Game.findOne({ gameId })).playerRoll === 6;

    if (isJackpot) {
      newWin = previousWin * JACKPOT_MULTIPLIER;
      user.balance += newWin;
      resultMessage = `🎰 **JACKPOT!**\nTwo 6s in a row!\n` +
        `👤 Roll: ${playerRoll} vs 🤖 Roll: ${botRoll}\n` +
        `💰 Won: ${newWin.toFixed(2)} ${user.currency}\n` +
        `🤖 "Unreal! You hit the jackpot!"`;
    } else if (playerRoll > botRoll) {
      newWin = previousWin * 2;
      user.balance += previousWin;
      resultMessage = `🎉 **Double Win!**\n` +
        `👤 Roll: ${playerRoll} vs 🤖 Roll: ${botRoll}\n` +
        `💰 Won: ${newWin.toFixed(2)} ${user.currency}\n` +
        `🤖 "Unbelievable luck!"`;
    } else {
      resultMessage = `💥 **Lost It All!**\n` +
        `👤 Roll: ${playerRoll} vs 🤖 Roll: ${botRoll}\n` +
        `💸 Lost: ${previousWin.toFixed(2)} ${user.currency}\n` +
        `🤖 "Better luck next time!"`;
    }

    user.gamesPlayed += 1;
    if (newWin > 0) {
      user.wins += 1;
      user.winStreak += 1;
      user.lossStreak = 0;
    } else {
      user.losses += 1;
      user.lossStreak += 1;
      user.winStreak = 0;
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
      difficulty: ctx.session.difficulty || 'normal',
    });
    await doubleGame.save();

    resultMessage += `\n🔹 **New Balance:** ${user.balance.toFixed(2)} ${user.currency}` +
      (user.winStreak > 1 ? `\n🔥 **Win Streak:** ${user.winStreak}` : user.lossStreak > 1 ? `\n💀 **Loss Streak:** ${user.lossStreak}` : '');
    await ctx.editMessageText(resultMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎲 Play Again', callback_data: 'play_pvc' },
            { text: '📊 Stats', callback_data: 'stats' },
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
      return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    }

    await ctx.replyWithMarkdown(
      `🎲 **Play Vs Computer**\n\n` +
      `Choose difficulty:\n` +
      `- Easy: Bot rolls 1-4\n` +
      `- Normal: Fair rolls\n` +
      `- Hard: Bot favors 6`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '😊 Easy', callback_data: 'difficulty_easy' },
              { text: '😐 Normal', callback_data: 'difficulty_normal' },
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
    ctx.session.difficulty = ctx.match[1];
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    const promptMsg = await ctx.replyWithMarkdown(
      `💵 **Bet Against the Computer**\n\n` +
      `Difficulty: ${ctx.session.difficulty}\n` +
      `Enter a bet between ${MIN_BET} and ${MAX_BET} ${user.currency}.\n` +
      `Type your bet amount (e.g., 250):`,
      { reply_markup: { force_reply: true } }
    );
    betPromptMessageId = promptMsg.message_id;
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
  });

  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    if (!ctx.message.reply_to_message || ctx.message.reply_to_message.message_id !== betPromptMessageId || !text.match(/^\d+$/)) {
      return next();
    }

    const betAmount = parseInt(text, 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');

    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      await ctx.replyWithMarkdown(
        `❌ **Invalid Bet**\nPlease enter an amount between ${MIN_BET} and ${MAX_BET} ${user.currency}.`
      );
      return;
    }

    await confirmGame(ctx, user, betAmount);
    await ctx.deleteMessage(ctx.message.message_id).catch(() => {});
    await ctx.deleteMessage(betPromptMessageId).catch(() => {});
    betPromptMessageId = null;
  });

  bot.action(/start_pvc_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    await startPvCGame(ctx, user, betAmount);
  });

  bot.action('cancel_pvc', async (ctx) => {
    await ctx.answerCbQuery('Game canceled.');
    await ctx.editMessageText('❌ **Game Cancelled**', { parse_mode: 'Markdown' });
    activeGames.delete(ctx.from.id);
  });

  bot.action(/double_(\d+\.?\d*)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const previousWin = parseFloat(ctx.match[1]);
    const gameId = ctx.match[2];
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    await doubleOrNothing(ctx, user, previousWin, gameId);
  });

  bot.action('play_pvc', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await exports.default(ctx); // Restart PvC flow
  });

  bot.action('stats', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    const games = await Game.find({ userId: user.telegramId }).sort({ timestamp: -1 }).limit(5);
    const statsMsg = `📊 **Your Stats**\n\n` +
      `🎮 Games Played: ${user.gamesPlayed}\n` +
      `✅ Wins: ${user.wins}\n` +
      `❌ Losses: ${user.losses}\n` +
      `🤝 Ties: ${user.ties}\n` +
      `🔥 Win Streak: ${user.winStreak}\n` +
      `💀 Loss Streak: ${user.lossStreak}\n\n` +
      `**Recent Games:**\n` +
      games.map(g => `${g.timestamp.toLocaleDateString()} - ${g.outcome.toUpperCase()} (${g.betAmount} ${user.currency})`).join('\n') || 'No recent games.';
    await ctx.replyWithMarkdown(statsMsg);
  });
};