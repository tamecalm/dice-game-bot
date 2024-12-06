const { Telegraf } = require('telegraf'); // Ensure you import correctly
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit'); // Ensure deposit.js uses ctx, not bot
const playCommand = require('./play');
const adminCommand = require('./admin');

// Initialize bot using 'new'
const bot = new Telegraf(settings.botToken);

// Attach command handlers directly to bot
bot.command('start', startCommand);
bot.command('balance', balanceCommand);
bot.command('deposit', depositCommand);
bot.command('play', playCommand);
bot.command('admin', adminCommand);

// Handle unknown commands or generic text
bot.on('text', (ctx) => {
  ctx.reply('Unknown command. Use /start to begin.');
});

// Export the bot instance
module.exports = bot;
