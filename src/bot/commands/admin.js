const { Markup } = require('telegraf');
const User = require('../../models/User');
const Game = require('../../models/Game');
const settings = require('../../config/settings');

module.exports = async (ctx) => {
  try {
    // Check if the user is the admin
    const adminId = settings.adminIds;
    if (ctx.from.id.toString() !== adminId) {
      return ctx.replyWithHTML('❌ <b>Unauthorized access.</b>');
    }

    // Build the Admin Panel with inline buttons
    const adminPanel = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Stats', 'admin_stats')],
      [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
      [Markup.button.callback('👤 Manage Users', 'admin_manage_users')],
      [Markup.button.callback('🎮 Manage Games', 'admin_manage_games')],
    ]);

    // Reply with the Admin Panel UI
    return ctx.replyWithHTML(
      `<b>🛠 Welcome to the Admin Panel</b>\n\n` +
        `Select an option below to manage the platform:`,
      adminPanel
    );
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

// Handle admin actions using callbacks
module.exports.handleAdminCallbacks = async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery.data;
    const adminId = settings.adminId;

    if (ctx.from.id.toString() !== adminId) {
      return ctx.answerCbQuery('Unauthorized access.', { show_alert: true });
    }

    switch (callbackData) {
      case 'admin_stats': {
        // Fetch platform statistics
        const totalUsers = await User.countDocuments();
        const totalGames = await Game.countDocuments();
        const totalDeposits = (
          await User.aggregate([
            { $group: { _id: null, total: { $sum: '$totalDeposits' } } },
          ])
        )[0]?.total || 0;

        // Reply with statistics
        return ctx.editMessageText(
          `<b>📊 Platform Statistics:</b>\n\n` +
            `👤 <b>Total Users:</b> ${totalUsers}\n` +
            `🎮 <b>Total Games:</b> ${totalGames}\n` +
            `💰 <b>Total Deposits:</b> ${totalDeposits.toFixed(2)} ${settings.defaultCurrency}`,
          { parse_mode: 'HTML', reply_markup: ctx.callbackQuery.message.reply_markup }
        );
      }

      case 'admin_broadcast': {
        // Provide broadcast instructions
        return ctx.editMessageText(
          `<b>📢 Broadcast:</b>\n\n` +
            `Send a message to all users.\n\n` +
            `Reply to this message with your broadcast content.`,
          { parse_mode: 'HTML' }
        );
      }

      case 'admin_manage_users': {
        // Provide user management options
        return ctx.editMessageText(
          `<b>👤 Manage Users:</b>\n\n` +
            `- <code>View User Data</code>\n` +
            `- <code>Block Users</code>\n` +
            `- <code>Reset Balances</code>\n\n` +
            `Use commands for advanced management.`,
          { parse_mode: 'HTML' }
        );
      }

      case 'admin_manage_games': {
        // Provide game management options
        return ctx.editMessageText(
          `<b>🎮 Manage Games:</b>\n\n` +
            `- <code>View Game Stats</code>\n` +
            `- <code>Cancel Games</code>\n` +
            `- <code>Resolve Disputes</code>\n\n` +
            `Select an option for detailed actions.`,
          { parse_mode: 'HTML' }
        );
      }

      default:
        // Handle unknown callbacks
        return ctx.answerCbQuery('❌ Unknown action.', { show_alert: true });
    }
  } catch (error) {
    console.error('Error handling admin callback:', error.message);
    ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
  }
};
