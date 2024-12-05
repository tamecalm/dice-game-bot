const { Telegraf } = require('telegraf');
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');

const bot = new Telegraf(settings.botToken);

// Inject bot into commands that need it
startCommand(bot);
balanceCommand(bot);
depositCommand(bot);
playCommand(bot);
adminCommand(bot);

// Handle unknown commands
bot.on('text', (ctx) => {
  ctx.reply('Unknown command. Use /start to begin.');
});

module.exports = bot;
