// bot/commands/gameModes/playPvC.js
import User from '../../../models/User.js'; // Adjust path
import settings from '../../config/settings.js'; // Adjust path

const COOLDOWN_TIME = 125000; // 125 seconds
const COMMISSION_RATE = 0.5; // 50% commission
const lastGameTime = {}; // Track cooldowns

const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) ctx.reply(`⚠️ Error at ${location}: ${error.message}`);
};

const rollDiceForUser = async (ctx) => {
  try {
    const diceMessage = await ctx.replyWithDice();
    const diceValue = diceMessage.dice.value;
    setTimeout(() => ctx.deleteMessage(diceMessage.message_id).catch(() => {}), 2000);
    return diceValue;
  } catch (error) {
    logError('rollDiceForUser', error, ctx);
    return null;
  }
};

const rollDiceForBot = async (ctx) => {
  try {
    const botDiceMessage = await ctx.replyWithMarkdown('🤖 **Bot is rolling...**');
    const diceValue = Math.floor(Math.random() * 6) + 1;
    setTimeout(() => ctx.deleteMessage(botDiceMessage.message_id).catch(() => {}), 2000);
    return diceValue;
  } catch (error) {
    logError('rollDiceForBot', error, ctx);
    return null;
  }
};

const confirmGame = async (ctx, user, betAmount) => {
  try {
    await ctx.replyWithMarkdown(
      `🎲 **Confirm Your Bet (Vs Computer)**\n\n` +
        `💵 **Bet Amount:** ${betAmount} ${user.currency}\n` +
        `🔹 **Your Balance:** ${user.balance.toFixed(2)} ${user.currency}\n\n` +
        `Ready to roll against the bot?`,
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
  } catch (error) {
    logError('confirmGamePvC', error, ctx);
  }
};

const startPvCGame = async (ctx, user, betAmount) => {
  try {
    const currentTime = Date.now();
    const lastGame = lastGameTime[user.telegramId] || 0;

    if (currentTime - lastGame < COOLDOWN_TIME) {
      await ctx.replyWithMarkdown(`⏳ **Cooldown Active**\nWait a bit before playing again.`);
      return;
    }
    lastGameTime[user.telegramId] = currentTime;

    if (user.balance < betAmount) {
      await ctx.replyWithMarkdown(`❌ **Insufficient Funds**\nYou need at least ${betAmount} ${user.currency}.`);
      return;
    }

    user.balance -= betAmount;
    await user.save();

    const admin = await User.findOne({ telegramId: settings.adminIds[0] });
    if (!admin) {
      await ctx.replyWithMarkdown(`❌ **Admin Error**\nContact support—admin not found.`);
      return;
    }

    await ctx.replyWithMarkdown(`🎮 **Game On!**\n\n👤 **${user.username}** vs 🤖 Bot`);
    const playerRoll = await rollDiceForUser(ctx);
    if (playerRoll === null) return;

    const botRoll = await rollDiceForBot(ctx);
    if (botRoll === null) return;

    let resultMessage;
    let winAmount = 0;

    if (playerRoll > botRoll) {
      winAmount = betAmount * 2;
      const commission = Math.floor(winAmount * COMMISSION_RATE);
      user.balance += winAmount - commission;
      admin.balance += commission;
      resultMessage = `🎉 **${user.username} Wins!**\n` +
        `👤 Roll: ${playerRoll} vs 🤖 Roll: ${botRoll}\n` +
        `💰 Won: ${(winAmount - commission).toFixed(2)} ${user.currency} (after ${commission} commission)`;
    } else if (botRoll > playerRoll) {
      admin.balance += betAmount;
      resultMessage = `🤖 **Bot Wins!**\n` +
        `👤 Roll: ${playerRoll} vs 🤖 Roll: ${botRoll}\n` +
        `💸 Bet lost to admin.`;
    } else {
      user.balance += betAmount;
      resultMessage = `🤝 **Tie!**\n` +
        `👤 Roll: ${playerRoll} vs 🤖 Roll: ${botRoll}\n` +
        `💵 Bet refunded.`;
    }

    user.gamesPlayed += 1;
    await user.save();
    await admin.save();

    resultMessage += `\n🔹 **New Balance:** ${user.balance.toFixed(2)} ${user.currency}`;
    await ctx.replyWithMarkdown(resultMessage, {
      reply_markup: {
        inline_keyboard: [[{ text: '🎲 Play Again', callback_data: 'play' }]],
      },
    });
  } catch (error) {
    logError('startPvCGame', error, ctx);
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
        callback_data: `bet_pvc_${amount}`,
      })),
      betAmounts.slice(3).map((amount) => ({
        text: `${amount} ${user.currency}`,
        callback_data: `bet_pvc_${amount}`,
      })),
    ];

    await ctx.replyWithMarkdown(
      `💵 **Bet Against the Computer**\n\nChoose your bet amount:`,
      { reply_markup: { inline_keyboard: inlineKeyboard } }
    );
  } catch (error) {
    logError('playPvC', error, ctx);
  }
};

// PvC-specific handlers
export const pvcHandlers = (bot) => {
  bot.action(/bet_pvc_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    await confirmGame(ctx, user, betAmount);
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  });

  bot.action(/start_pvc_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const betAmount = parseInt(ctx.match[1], 10);
    const user = await User.findOne({ telegramId: ctx.from.id });
    if (!user) return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join.');
    await startPvCGame(ctx, user, betAmount);
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  });

  bot.action('cancel_pvc', async (ctx) => {
    await ctx.answerCbQuery('Game canceled.');
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    await ctx.replyWithMarkdown('❌ **Game Cancelled**');
  });
};