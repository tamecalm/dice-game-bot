// Bot Logics

const { Telegraf } = require('telegraf');
const settings = require('../../config/settings');
const startCommand = require('./commands/start');
const balanceCommand = require('./commands/balance');
const depositCommand = require('./commands/deposit');
const playCommand = require('./commands/play');
const adminCommand = require('./commands/admin');

const bot = new Telegraf(settings.botToken);

bot.start(startCommand);
bot.command('balance', balanceCommand);
bot.command('deposit', depositCommand);
bot.command('play', playCommand);
bot.command('admin', adminCommand);

bot.on('text', (ctx) => {
  ctx.reply('Unknown command. Use /start to begin.');
});

module.exports = bot;