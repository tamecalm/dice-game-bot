import User from '../../models/User.js';
import Game from '../../models/Game.js';
import cron from 'node-cron';

// Constants
const WEEKLY_REWARDS = [50, 30, 10]; // Rewards for top 3
const LEADERBOARD_LIMIT = 10; // Top 10 players
const RANK_EMOJIS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const STATUS_EMOJIS = { win: '✅', loss: '❌', tie: '➖', none: '➖' };

// State tracking
let currentMessageId = null;
let cachedLeaderboard = null;
let lastUpdateTime = null;

// Log errors
const logError = (location, error) => {
  console.error(`Error at ${location}:`, error.message || error);
};

// Clean up old message
const cleanUpMessage = async (ctx, messageId) => {
  if (messageId && ctx?.telegram) {
    await ctx.telegram.deleteMessage(ctx.chat.id, messageId).catch(() => {});
  }
};

// Format leaderboard entry with proper alignment
const formatEntry = (index, user, wins, lastGameStatus) => {
  const rank = RANK_EMOJIS[index] || `${index + 1}`;
  const name = user.username.padEnd(12, ' '); // Max 12 chars, adjust as needed
  const winsStr = wins.toString().padStart(2, ' '); // Align wins
  const status = STATUS_EMOJIS[lastGameStatus] || STATUS_EMOJIS.none;
  return `${rank} ${name} — ${winsStr} Wins ${status}`;
};

// Fetch and cache leaderboard data
const fetchLeaderboardData = async () => {
  try {
    // Fetch top 10 users by weeklyWins, with a secondary sort by wins
    const users = await User.find()
      .sort({ weeklyWins: -1, wins: -1 })
      .limit(LEADERBOARD_LIMIT)
      .select('telegramId username weeklyWins'); // Minimize data fetched

    if (!users.length) return null;

    // Batch fetch recent games for all users to reduce API calls
    const userIds = users.map(user => user.telegramId);
    const recentGames = await Game.find({
      $or: [{ userId: { $in: userIds } }, { opponentId: { $in: userIds } }],
    })
      .sort({ timestamp: -1 })
      .limit(userIds.length) // One game per user
      .select('userId opponentId outcome timestamp');

    // Map recent game outcomes to users
    const lastGameMap = new Map();
    recentGames.forEach(game => {
      if (!lastGameMap.has(game.userId)) lastGameMap.set(game.userId, game.outcome);
      if (!lastGameMap.has(game.opponentId)) lastGameMap.set(game.opponentId, game.outcome);
    });

    // Build leaderboard entries
    const entries = users.map((user, index) => {
      const lastGameStatus = lastGameMap.get(user.telegramId) || 'none';
      return formatEntry(index, user, user.weeklyWins, lastGameStatus);
    });

    return {
      text: entries.join('\n'),
      timestamp: new Date(),
    };
  } catch (error) {
    logError('fetchLeaderboardData', error);
    return null;
  }
};

// Render leaderboard
const renderLeaderboard = async (ctx) => {
  try {
    if (!ctx?.telegram) throw new Error('Invalid context');

    // Use cached data if available and recent
    if (!cachedLeaderboard || Date.now() - lastUpdateTime > 60000) { // Refresh every 60s
      cachedLeaderboard = await fetchLeaderboardData();
      lastUpdateTime = Date.now();
    }

    const leaderboardData = cachedLeaderboard;
    const updateTime = new Date(lastUpdateTime).toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });

    const messageText = leaderboardData
      ? `🏆 Weekly Leaderboard\n━━━━━━━━━━━━━\n${leaderboardData.text}\n━━━━━━━━━━━━━\n📅 Last Update: ${updateTime} UTC`
      : `🏆 Weekly Leaderboard\n━━━━━━━━━━━━━\nNo players yet!\n━━━━━━━━━━━━━\n📅 Last Update: ${updateTime} UTC`;

    const msg = await ctx.reply(messageText, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🔄 Refresh', callback_data: 'leaderboard_refresh' },
          { text: '🎲 Play', callback_data: 'play_pvp' },
        ]],
      },
    });

    currentMessageId = msg.message_id;
  } catch (error) {
    logError('renderLeaderboard', error);
    await ctx.reply('⚠️ Error loading leaderboard').catch(() => {});
  }
};

// Reset weekly wins and distribute rewards
const resetWeeklyLeaderboard = async (bot) => {
  try {
    const topPlayers = await User.find()
      .sort({ weeklyWins: -1 })
      .limit(3);

    for (let i = 0; i < topPlayers.length; i++) {
      if (topPlayers[i].weeklyWins > 0) {
        topPlayers[i].balance += WEEKLY_REWARDS[i];
        topPlayers[i].weeklyWins = 0;
        await topPlayers[i].save();
        await bot.telegram.sendMessage(
          topPlayers[i].telegramId,
          `🏆 Weekly Leaderboard Reward!\nRank #${i + 1}: +${WEEKLY_REWARDS[i]} ${topPlayers[i].currency}`
        ).catch(err => logError('notifyReward', err));
      }
    }

    await User.updateMany({}, { weeklyWins: 0 });
    cachedLeaderboard = null; // Invalidate cache
    console.log('Weekly leaderboard reset and rewards distributed.');
  } catch (error) {
    logError('resetWeeklyLeaderboard', error);
  }
};

// Main entry point
export default async (ctx) => {
  await renderLeaderboard(ctx);
};

// Handlers
export const leaderboardHandlers = (bot) => {
  bot.command('leaderboard', async (ctx) => {
    await renderLeaderboard(ctx);
  });

  bot.action('leaderboard_refresh', async (ctx) => {
    await ctx.answerCbQuery('Refreshing leaderboard...');
    await cleanUpMessage(ctx, currentMessageId);
    cachedLeaderboard = null; // Force refresh
    await renderLeaderboard(ctx);
  });

  // Weekly reset: Monday at midnight UTC
  cron.schedule('0 0 * * 1', () => resetWeeklyLeaderboard(bot), { timezone: 'UTC' });
};