// Bot Logics

const { Telegraf } = require('telegraf');
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');

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