// Admin Logics

const User = require('../../models/User');
const Game = require('../../models/Game');
const settings = require('../../config/settings');

module.exports = async (ctx) => {
  const adminId = settings.adminId;

  if (ctx.from.id.toString() !== adminId) {
    return ctx.reply('Unauthorized access.');
  }

  const commandArgs = ctx.message.text.split(' ').slice(1);
  const subCommand = commandArgs[0];

  switch (subCommand) {
    case 'stats':
      const totalUsers = await User.countDocuments();
      const totalGames = await Game.countDocuments();
      const totalDeposits = (await User.aggregate([{ $group: { _id: null, total: { $sum: '$totalDeposits' } } }]))[0]?.total || 0;

      return ctx.reply(`Admin Stats:\n- Total Users: ${totalUsers}\n- Total Games: ${totalGames}\n- Total Deposits: ${totalDeposits.toFixed(2)} ${settings.defaultCurrency}`);
    
    case 'broadcast':
      const message = commandArgs.slice(1).join(' ');
      const users = await User.find();

      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegramId, `📢 Announcement: ${message}`);
        } catch (err) {
          console.error(`Failed to send message to ${user.telegramId}:`, err);
        }
      }

      return ctx.reply('Broadcast sent successfully.');
    
    default:
      return ctx.reply('Admin Commands:\n- /admin stats\n- /admin broadcast [message]');
  }
};