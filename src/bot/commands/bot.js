const { Telegraf } = require('telegraf'); // Import as a function
const settings = require('../../config/settings');
const startCommand = require('./start');
const balanceCommand = require('./balance');
const depositCommand = require('./deposit');
const playCommand = require('./play');
const adminCommand = require('./admin');

// Initialize the bot using the imported function
const bot = Telegraf(settings.botToken); // Use as a function, not a constructor

// Register commands properly
bot.start(async (ctx) => await startCommand(ctx)); // Register /start command
bot.command('balance', async (ctx) => await balanceCommand(ctx)); // Register /balance command
bot.command('deposit', async (ctx) => await depositCommand(ctx)); // Register /deposit command
bot.command('play', async (ctx) => await playCommand(ctx)); // Register /play command
bot.command('admin', async (ctx) => await adminCommand(ctx)); // Register /admin command

// Handle unknown commands
bot.on('text', (ctx) => {
  ctx.reply('Unknown command. Use /start to begin.');
});

module.exports = bot;
