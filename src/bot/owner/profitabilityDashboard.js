import User from '../../models/User.js';
import Game from '../../models/Game.js';
import settings from '../../config/settings.js';

// Calculate profitability metrics
const calculateProfitability = async () => {
  try {
    const games = await Game.find({});
    const totalBets = games.reduce((sum, game) => sum + game.betAmount, 0);
    const totalWinnings = games.reduce((sum, game) => sum + game.winnings, 0);
    const totalCommission = games.reduce((sum, game) => sum + game.commission, 0);
    const totalBotWins = games
      .filter(g => g.outcome === 'loss')
      .reduce((sum, game) => sum + (game.botRoll === 6 ? Math.floor(game.betAmount * 0.6) : game.betAmount), 0);
    const netProfit = totalBotWins + totalCommission - totalWinnings;

    return {
      totalGames: games.length,
      totalBets: totalBets.toFixed(2),
      totalWinnings: totalWinnings.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      totalBotWins: totalBotWins.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };
  } catch (error) {
    console.error('Error calculating profitability:', error.message);
    return null;
  }
};

// Profitability dashboard command
export default (bot) => {
  bot.command('profit', async (ctx) => {
    try {
      const telegramId = String(ctx.from.id); // Convert to string for comparison
      if (!settings.adminIds.includes(telegramId)) {
        return ctx.replyWithMarkdown('❌ **Access Denied**\nAdmins only!');
      }

      const stats = await calculateProfitability();
      if (!stats) {
        return ctx.replyWithMarkdown('⚠️ **Error**\nCouldn’t fetch stats.');
      }

      const message = `📊 **Profit Dashboard**\n\n` +
        `🎮 **Games Played**: ${stats.totalGames}\n` +
        `💰 **Total Bets**: $${stats.totalBets}\n` +
        `🎁 **Winnings Paid**: $${stats.totalWinnings}\n` +
        `📈 **Commission Earned**: $${stats.totalCommission}\n` +
        `🤖 **Bot Wins**: $${stats.totalBotWins}\n` +
        `💼 **Net Profit**: $${stats.netProfit} ${stats.netProfit >= 0 ? '(Profit)' : '(Loss)'}\n\n` +
        `Updated: ${new Date().toLocaleString()}`;

      await ctx.replyWithMarkdown(message);
    } catch (error) {
      console.error('Profit command error:', error.message);
      await ctx.replyWithMarkdown('⚠️ **Error**\nSomething went wrong.');
    }
  });
};