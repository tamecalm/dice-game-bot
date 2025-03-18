import User from '../../models/User.js';
import Game from '../../models/Game.js';

// Calculate user stats
const calculateUserStats = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return null;

    const games = await Game.find({ userId: telegramId }).sort({ timestamp: -1 }).limit(5);
    const totalSpent = games.reduce((sum, game) => sum + game.betAmount + (game.powerUp ? Math.floor(game.betAmount * { reroll: 0.20, shield: 0.25, boost: 0.30 }[game.powerUp]) : 0), 0);
    const totalWon = games.reduce((sum, game) => sum + game.winnings, 0);
    const netResult = totalWon - totalSpent;

    return {
      user,
      games,
      totalSpent: totalSpent.toFixed(2),
      totalWon: totalWon.toFixed(2),
      netResult: netResult.toFixed(2),
    };
  } catch (error) {
    console.error('Error calculating user stats:', error.message);
    return null;
  }
};

// User stats handler
export default (bot) => {
  bot.command('stats', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const stats = await calculateUserStats(telegramId);
      if (!stats) {
        return ctx.replyWithMarkdown('❌ **Not Registered**\nUse /start to join!');
      }

      const { user, games, totalSpent, totalWon, netResult } = stats;
      const message = `📊 **Your Stats**\n\n` +
        `🎮 **Games**: ${user.gamesPlayed}\n` +
        `✅ **Wins**: ${user.wins}\n` +
        `❌ **Losses**: ${user.losses}\n` +
        `🤝 **Ties**: ${user.ties}\n` +
        `💰 **Spent**: $${totalSpent}\n` +
        `🎁 **Won**: $${totalWon}\n` +
        `📈 **Net**: $${netResult} ${netResult >= 0 ? '(Gain)' : '(Loss)'}\n` +
        (netResult < 0 ? `⚠️ **Tip**: Take a break if losses pile up!\n` : '') +
        `🔥 **Win Streak**: ${user.winStreak}\n` +
        `💀 **Loss Streak**: ${user.lossStreak}\n\n` +
        `**Last 5 Games**:\n` +
        (games.length > 0
          ? games.map(g => `${g.timestamp.toLocaleDateString()} | ${g.outcome.toUpperCase()} | $${g.betAmount}${g.powerUp ? ` (${g.powerUp})` : ''}`).join('\n')
          : 'No games yet.');

      await ctx.replyWithMarkdown(message);
    } catch (error) {
      console.error('Stats action error:', error.message);
      await ctx.replyWithMarkdown('⚠️ **Error**\nCouldn’t load stats.');
    }
  });
};