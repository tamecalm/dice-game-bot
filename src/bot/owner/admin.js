// src/bot/owner/admin.js
import { Markup } from 'telegraf'; // ES6 import
import User from '../../models/User.js'; // ES6 import
import Game from '../../models/Game.js'; // ES6 import
import Admin from '../../models/Admin.js'; // ES6 import (unused but kept for consistency)
import settings from '../../config/settings.js'; // ES6 import
import moment from 'moment'; // ES6 import

export function setupAdmin(bot) {
  // Check if user is an admin
  const isAdmin = (ctx) => settings.adminIds.includes(ctx.from.id);

  // Admin Panel entry point
  bot.command('admin', async (ctx) => {
    try {
      if (!isAdmin(ctx)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      await ctx.editMessageText(
        `🛠 **Admin Panel**\n\n` +
          `Manage the platform with these options:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [Markup.button.callback('📊 Stats', 'admin_stats')],
              [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
              [Markup.button.callback('👤 Manage Users', 'admin_manage_users')],
              [Markup.button.callback('🎮 Manage Games', 'admin_manage_games')],
              [Markup.button.callback('⬅️ Back', 'clear')],
            ],
          },
        }
      );
    } catch (error) {
      console.error('Error in admin panel:', error.message);
      await ctx.answerCbQuery('⚠️ Something went wrong.', { show_alert: true });
    }
  });

  // Admin Stats
  bot.action('admin_stats', async (ctx) => {
    try {
      if (!isAdmin(ctx)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      const totalUsers = await User.countDocuments();
      const totalGames = await Game.countDocuments();
      const totalDeposits = (
        await User.aggregate([{ $group: { _id: null, total: { $sum: '$totalDeposits' } } }])
      )[0]?.total || 0;

      await ctx.editMessageText(
        `📊 **Platform Stats**\n\n` +
          `👤 **Total Users:** ${totalUsers}\n` +
          `🎮 **Total Games:** ${totalGames}\n` +
          `💰 **Total Deposits:** ${totalDeposits.toFixed(2)} ${settings.defaultCurrency || 'NGN'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[Markup.button.callback('⬅️ Back to Panel', 'admin')]],
          },
        }
      );
    } catch (error) {
      console.error('Error in admin stats:', error.message);
      await ctx.answerCbQuery('⚠️ Something went wrong.', { show_alert: true });
    }
  });

  // Admin Broadcast initiation
  bot.action('admin_broadcast', async (ctx) => {
    try {
      if (!isAdmin(ctx)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      await ctx.editMessageText(
        `📢 **Broadcast Message**\n\n` +
          `Reply to this message with the content you want to send to all users.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[Markup.button.callback('⬅️ Back to Panel', 'admin')]],
          },
        }
      );
    } catch (error) {
      console.error('Error in admin broadcast:', error.message);
      await ctx.answerCbQuery('⚠️ Something went wrong.', { show_alert: true });
    }
  });

  // Handle broadcast message input
  bot.on('text', async (ctx) => {
    if (!isAdmin(ctx)) return; // Only admins can broadcast
    if (!ctx.message.reply_to_message?.text?.includes('Broadcast Message')) return; // Check if replying to broadcast prompt

    try {
      const broadcastContent = ctx.message.text;
      const users = await User.find({}, 'telegramId');

      let successCount = 0;
      for (const user of users) {
        try {
          await bot.telegram.sendMessage(
            user.telegramId,
            `📢 **Admin Broadcast**\n\n${broadcastContent}\n\n*Sent on ${moment().format('MMMM Do YYYY, h:mm:ss a')}*`,
            { parse_mode: 'Markdown' }
          );
          successCount++;
        } catch (sendError) {
          console.error(`Failed to send broadcast to ${user.telegramId}:`, sendError.message);
        }
      }

      await ctx.replyWithMarkdown(
        `✅ **Broadcast Sent**\n\n` +
          `📩 Reached ${successCount} out of ${users.length} users.`
      );
    } catch (error) {
      console.error('Error sending broadcast:', error.message);
      await ctx.reply('⚠️ Failed to send broadcast. Try again.');
    }
  });

  // Admin Manage Users
  bot.action('admin_manage_users', async (ctx) => {
    try {
      if (!isAdmin(ctx)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      await ctx.editMessageText(
        `👤 **Manage Users**\n\n` +
          `- View user data\n` +
          `- Block users\n` +
          `- Reset balances\n\n` +
          `*Use commands for advanced management (coming soon).*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[Markup.button.callback('⬅️ Back to Panel', 'admin')]],
          },
        }
      );
    } catch (error) {
      console.error('Error in manage users:', error.message);
      await ctx.answerCbQuery('⚠️ Something went wrong.', { show_alert: true });
    }
  });

  // Admin Manage Games
  bot.action('admin_manage_games', async (ctx) => {
    try {
      if (!isAdmin(ctx)) {
        return ctx.answerCbQuery('❌ Unauthorized access.', { show_alert: true });
      }

      await ctx.editMessageText(
        `🎮 **Manage Games**\n\n` +
          `- View game stats\n` +
          `- Cancel games\n` +
          `- Resolve disputes\n\n` +
          `*Select an option for detailed actions (coming soon).*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[Markup.button.callback('⬅️ Back to Panel', 'admin')]],
          },
        }
      );
    } catch (error) {
      console.error('Error in manage games:', error.message);
      await ctx.answerCbQuery('⚠️ Something went wrong.', { show_alert: true });
    }
  });
}