const { Telegraf } = require('telegraf'); // Ensure you import correctly
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');

// Initialize bot using 'new'
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
    playCommand(bot)(ctx); // Pass bot as argument to playCommand
  } else if (text === '/admin') {
    adminCommand(ctx);
  } else {
    // Handle unknown commands
    ctx.reply('Unknown command. Use /start to begin.');
  }
});

// bot.launch(); // Launch the bot
