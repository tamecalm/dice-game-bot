// Admin Logics
const User = require('../../models/User');
const Game = require('../../models/Game');
const settings = require('../../config/settings');

module.exports = async (ctx) => {
  try {
    // Ensure context validity
    if (!ctx.from || !ctx.message?.text) {
      console.error('Invalid context object received:', ctx);
      return ctx.replyWithHTML(
        '❌ <b>An unexpected error occurred.</b>\nPlease try again later.'
      );
    }

    // Check if the user is the admin
    const adminId = settings.adminId;
    if (ctx.from.id.toString() !== adminId) {
      return ctx.replyWithHTML('❌ <b>Unauthorized access.</b>');
    }

    // Parse command and arguments
    const commandArgs = ctx.message.text.split(' ').slice(1);
    const subCommand = commandArgs[0]?.toLowerCase();

    switch (subCommand) {
      case 'stats': {
        // Fetch stats
        const totalUsers = await User.countDocuments();
        const totalGames = await Game.countDocuments();
        const totalDeposits = (
          await User.aggregate([
            { $group: { _id: null, total: { $sum: '$totalDeposits' } } },
          ])
        )[0]?.total || 0;

        // Reply with stats
        return ctx.replyWithHTML(
          `<b>📊 Admin Stats:</b>\n` +
          `👤 <b>Total Users:</b> ${totalUsers}\n` +
          `🎮 <b>Total Games:</b> ${totalGames}\n` +
          `💰 <b>Total Deposits:</b> ${totalDeposits.toFixed(2)} ${settings.defaultCurrency}`
        );
      }

      case 'broadcast': {
        const message = commandArgs.slice(1).join(' ');

        if (!message) {
          return ctx.replyWithHTML(
            '❌ <b>Invalid broadcast message.</b>\nPlease provide a message to send.'
          );
        }

        const users = await User.find();

        // Send broadcast to all users
        let successCount = 0;
        let failCount = 0;

        for (const user of users) {
          try {
            await ctx.telegram.sendMessage(
              user.telegramId,
              `📢 <b>Announcement:</b>\n${message}`,
              { parse_mode: 'HTML' }
            );
            successCount++;
          } catch (err) {
            console.error(`Failed to send message to ${user.telegramId}:`, err);
            failCount++;
          }
        }

        // Reply with broadcast results
        return ctx.replyWithHTML(
          `📢 <b>Broadcast Results:</b>\n` +
          `✅ <b>Messages Sent:</b> ${successCount}\n` +
          `❌ <b>Failed Deliveries:</b> ${failCount}`
        );
      }

      default:
        // Reply with command usage guide
        return ctx.replyWithHTML(
          `<b>⚙️ Admin Commands:</b>\n` +
          `- <code>/admin stats</code> — View platform statistics.\n` +
          `- <code>/admin broadcast [message]</code> — Send a broadcast to all users.`
        );
    }
  } catch (error) {
    console.error('Error in admin command:', error.message);

    // Handle unexpected errors
    if (ctx && typeof ctx.reply === 'function') {
      ctx.replyWithHTML(
        '❌ <b>An unexpected error occurred.</b>\nPlease try again later.'
      );
    }
  }
};
