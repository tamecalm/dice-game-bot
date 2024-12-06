const { Telegraf } = require('telegraf'); // Correct import for Telegraf v4.x
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');

// Initialize the bot correctly using 'new' since Telegraf is a class
const bot = new Telegraf(settings.botToken);

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
