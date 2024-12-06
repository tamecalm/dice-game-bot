const { Telegraf } = require('telegraf'); // Ensure you import correctly
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit'); // Ensure deposit.js uses bot instance
const playCommand = require('./play');
const adminCommand = require('./admin');

// Initialize bot using 'new'
const bot = new Telegraf(settings.botToken);

// Attach command handlers
startCommand(bot);
balanceCommand(bot);
depositCommand(bot); // Pass bot instance to deposit.js
playCommand(bot);
adminCommand(bot);

// Handle unknown commands or generic text
bot.on('text', (ctx) => {
  ctx.reply('Unknown command. Use /start to begin.');
});

// Export the bot instance
module.exports = bot;
