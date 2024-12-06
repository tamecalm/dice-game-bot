const { Telegraf } = require('telegraf'); // Import Telegraf correctly for v4.x
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');

// Initialize the bot as a function
const bot = Telegraf(settings.botToken); // No need for `new` in v4.x

// Handle specific commands
bot.on('text', (ctx) => {
  const text = ctx.message.text;

  // Check for specific commands and handle accordingly
  if (text === '/start') {
    startCommand(ctx);
  } else if (text === '/balance') {
    balanceCommand(ctx);
  } else if (text === '/deposit') {
    depositCommand(ctx);
  } else if (text === '/play') {
    playCommand(ctx);
  } else if (text === '/admin') {
    adminCommand(ctx);
  } else {
    // Handle unknown commands
    ctx.reply('Unknown command. Use /start to begin.');
  }
});

module.exports = bot;
