const { Markup } = require('telegraf');
const User = require('../../models/User');
const Game = require('../../models/Game');
const Admin = require('../../models/Admin');
const settings = require('../../config/settings');
const moment = require('moment'); // For time formatting

module.exports = (bot) => {
  // Handle Admin Panel access
  bot.action('admin', async (ctx) => {
    try {
      const adminId = settings.adminIds;
      if (!adminId.includes(ctx.from.id)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      const adminPanel = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Stats', 'admin_stats')],
        [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
        [Markup.button.callback('👤 Manage Users', 'admin_manage_users')],
        [Markup.button.callback('🎮 Manage Games', 'admin_manage_games')],
        [Markup.button.callback('🔙 Back to Menu', 'menu')] // Added back-to-menu button
      ]);

      await ctx.editMessageText(
        `<b>🛠 Welcome to the Admin Panel</b>\n\n` +
        `Select an option below to manage the platform:`,
        { parse_mode: 'HTML', reply_markup: adminPanel }
      );
    } catch (error) {
      console.error('Error in admin panel handler:', error.message);
      ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
    }
  });

  // Handle admin registration
  bot.action('admin_register', async (ctx) => {
    try {
      // Check if the user is already an admin
      const existingAdmin = await Admin.findOne({ telegramId: ctx.from.id });
      if (existingAdmin) {
        return ctx.answerCbQuery('You are already registered as an admin.');
      }

      // Register admin details in the database
      const newAdmin = new Admin({
        telegramId: ctx.from.id,
        username: ctx.from.username,
        role: 'Admin', // Default role
        status: 'Active',
        email: '', // You can prompt to add email later
        totalActions: 0
      });
      await newAdmin.save();

      await ctx.answerCbQuery('✅ You have been successfully registered as an admin.');
    } catch (error) {
      console.error('Error during admin registration:', error.message);
      ctx.answerCbQuery('❌ Failed to register as admin.');
    }
  });

  // Handle admin stats action
  bot.action('admin_stats', async (ctx) => {
    try {
      const adminId = settings.adminIds;
      if (!adminId.includes(ctx.from.id)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      const totalUsers = await User.countDocuments();
      const totalGames = await Game.countDocuments();
      const totalDeposits = (
        await User.aggregate([
          { $group: { _id: null, total: { $sum: '$totalDeposits' } } },
        ])
      )[0]?.total || 0;

      await ctx.editMessageText(
        `<b>📊 Platform Statistics:</b>\n\n` +
        `👤 <b>Total Users:</b> ${totalUsers}\n` +
        `🎮 <b>Total Games:</b> ${totalGames}\n` +
        `💰 <b>Total Deposits:</b> ${totalDeposits.toFixed(2)} ${settings.defaultCurrency}`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Error handling admin stats:', error.message);
      ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
    }
  });

  // Handle admin broadcast action
  bot.action('admin_broadcast', async (ctx) => {
    try {
      const adminId = settings.adminIds;
      if (!adminId.includes(ctx.from.id)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      await ctx.editMessageText(
        `<b>📢 Broadcast:</b>\n\n` +
        `Send a message to all users.\n\n` +
        `Reply to this message with your broadcast content.`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Error handling admin broadcast:', error.message);
      ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
    }
  });

  // Handle admin manage users action
  bot.action('admin_manage_users', async (ctx) => {
    try {
      const adminId = settings.adminIds;
      if (!adminId.includes(ctx.from.id)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      await ctx.editMessageText(
        `<b>👤 Manage Users:</b>\n\n` +
        `- <code>View User Data</code>\n` +
        `- <code>Block Users</code>\n` +
        `- <code>Reset Balances</code>\n\n` +
        `Use commands for advanced management.`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Error handling admin manage users:', error.message);
      ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
    }
  });

  // Handle admin manage games action
  bot.action('admin_manage_games', async (ctx) => {
    try {
      const adminId = settings.adminIds;
      if (!adminId.includes(ctx.from.id)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      await ctx.editMessageText(
        `<b>🎮 Manage Games:</b>\n\n` +
        `- <code>View Game Stats</code>\n` +
        `- <code>Cancel Games</code>\n` +
        `- <code>Resolve Disputes</code>\n\n` +
        `Select an option for detailed actions.`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Error handling admin manage games:', error.message);
      ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
    }
  });

  // Implement the back to menu button functionality
  bot.action('menu', async (ctx) => {
    const menu = Markup.inlineKeyboard([
      [Markup.button.callback('💼 Admin Panel', 'admin')]
    ]);

    await ctx.editMessageText(
      `<b>Welcome to the Bot</b>\n\n` +
      `Select an option below:`,
      { parse_mode: 'HTML', reply_markup: menu }
    );
  });
};
