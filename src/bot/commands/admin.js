// ==========================================================================
// Dice Game Bot Project - Script Header
// ==========================================================================
//
// Project: Dice Game Bot
// Repository: https://github.com/tamecalm/dice-game-bot
// 
// Description: 
// A robust and extensible module designed for a multiplayer dice game bot. 
// Feel free to use, modify, or contribute to the project under the terms of the repository's license.
//
// Author: Engr John! 🧑‍💻
// Year: 2024
// 
// License: Licensed under the terms of the repository's license. Unauthorized duplication, 
// Modification, or distribution of this script outside the license terms is prohibited.
// ==========================================================================

const { Markup } = require('telegraf');
const User = require('../../models/User');
const Game = require('../../models/Game');
const Admin = require('../../models/Admin');
const settings = require('../../config/settings');
const bot = require('./bot');
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
        [Markup.button.callback('🔙 Back to Menu', 'menu')] // "Back to Menu" button
      ]);

      await ctx.editMessageText(
        `<b>🛠 Welcome to the Admin Panel</b>\n\n` +
        `Select an option below to manage the platform:`,
        { parse_mode: 'HTML', reply_markup: adminPanel.reply_markup }
      );
    } catch (error) {
      console.error('Error in admin panel handler:', error.message);
      ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
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

      const statsKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Admin Panel', 'admin')]
      ]);

      await ctx.editMessageText(
        `<b>📊 Platform Statistics:</b>\n\n` +
        `👤 <b>Total Users:</b> ${totalUsers}\n` +
        `🎮 <b>Total Games:</b> ${totalGames}\n` +
        `💰 <b>Total Deposits:</b> ${totalDeposits.toFixed(2)} ${settings.defaultCurrency}`,
        { parse_mode: 'HTML', reply_markup: statsKeyboard.reply_markup }
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

      const broadcastKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Admin Panel', 'admin')]
      ]);

      await ctx.editMessageText(
        `<b>📢 Broadcast:</b>\n\n` +
        `Send a message to all users.\n\n` +
        `Reply to this message with your broadcast content.`,
        { parse_mode: 'HTML', reply_markup: broadcastKeyboard.reply_markup }
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

      const usersKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Admin Panel', 'admin')]
      ]);

      await ctx.editMessageText(
        `<b>👤 Manage Users:</b>\n\n` +
        `- <code>View User Data</code>\n` +
        `- <code>Block Users</code>\n` +
        `- <code>Reset Balances</code>\n\n` +
        `Use commands for advanced management.`,
        { parse_mode: 'HTML', reply_markup: usersKeyboard.reply_markup }
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

      const gamesKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Admin Panel', 'admin')]
      ]);

      await ctx.editMessageText(
        `<b>🎮 Manage Games:</b>\n\n` +
        `- <code>View Game Stats</code>\n` +
        `- <code>Cancel Games</code>\n` +
        `- <code>Resolve Disputes</code>\n\n` +
        `Select an option for detailed actions.`,
        { parse_mode: 'HTML', reply_markup: gamesKeyboard.reply_markup }
      );
    } catch (error) {
      console.error('Error handling admin manage games:', error.message);
      ctx.answerCbQuery('❌ An unexpected error occurred.', { show_alert: true });
    }
  });

  // Handle the back to menu action
  bot.action('admin', async (ctx) => {
    const menuKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💼 Admin Panel', 'admin')]
    ]);

    await ctx.editMessageText(
      `<b>Welcome to the Bot</b>\n\n` +
      `Select an option below:`,
      { parse_mode: 'HTML', reply_markup: menuKeyboard.reply_markup }
    );
  });
};


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
