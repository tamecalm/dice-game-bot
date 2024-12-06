const Telegraf = require('telegraf'); // Import without destructuring
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');

// Initialize the bot with 'new' since Telegraf is a class in version 3.x
const bot = new Telegraf(settings.botToken);

// Register commands properly using .command() in v3.x
bot.on('start', (ctx) => startCommand(ctx)); // Register /start command
bot.on('balance', (ctx) => balanceCommand(ctx)); // Register /balance command
bot.on('deposit', (ctx) => depositCommand(ctx)); // Register /deposit command
bot.on('play', (ctx) => playCommand(ctx)); // Register /play command
bot.on('admin', (ctx) => adminCommand(ctx)); // Register /admin command

// Handle unknown commands
bot.on('text', (ctx) => {
  ctx.reply('Unknown command. Use /start to begin.');
});

module.exports = bot;
