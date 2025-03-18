import { Telegraf } from "telegraf";
import LocalSession from 'telegraf-session-local';
import dotenv from 'dotenv';
import chalk from 'chalk';
import gradient from 'gradient-string';
import express from 'express';
import connectDb from '../src/database/db.js';
import flutterwaveWebhook from '../src/webhook/webhook.js';

// Command Handlers
import { setupStart } from '../src/bot/core/start.js';
import { setupBalance } from '../src/bot/coins/balance.js';
import { setupDeposit } from '../src/bot/coins/deposit.js';
import { setupPlay } from '../src/bot/play/play.js';
import { setupAdmin } from '../src/bot/owner/admin.js';
import { setupWithdrawal } from '../src/bot/coins/withdrawal.js';
import { setupReferral } from '../src/bot/coins/referral.js';
import { pvcHandlers } from '../src/bot/gameModes/playPvC.js';
import { pvpHandlers } from '../src/bot/gameModes/playPvP.js';
import  profitabilityDashboard  from '../src/bot/owner/profitabilityDashboard.js';
import  userStats  from '../src/bot/play/gameStats.js';

// Load environment variables
dotenv.config();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 4000;

if (!BOT_TOKEN) {
  console.error(chalk.red('❌ Missing TELEGRAM_BOT_TOKEN in .env file!'));
  process.exit(1);
}

// Initialize Bot and Express
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Express Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Webhook Endpoints
app.use('/webhooks/flutterwave', flutterwaveWebhook);
app.get('/status', (_req, res) => res.send('✅ Dice Game Bot is running...'));

// Sequential Startup
(async () => {
  try {
    // Step 1: Connect to Database
    console.log(chalk.blue('🔄 Connecting to database...'));
    await connectDb();
    console.log(chalk.green('✅ Database connected'));

    // Add session middleware
    bot.use(new LocalSession({ database: 'sessions.json' }).middleware());


   // Step 2: Setup Command Handlers
console.log(gradient.pastel('🚀 Setting up command handlers...'));
  profitabilityDashboard(bot);
  userStats(bot);
const handlers = [
  setupStart,
  setupPlay,
  // setupBalance,
  // setupDeposit,
  // setupWithdrawal,
  // setupReferral,
  // setupAdmin,
  pvcHandlers,
  pvpHandlers,
];

handlers.forEach((setupFunction) => {
  if (typeof setupFunction === 'function') {
    setupFunction(bot);
  } else {
    console.error(chalk.red(`❌ Error loading a handler: ${setupFunction}`));
  }
});

console.log(chalk.green('✅ All command handlers registered'));

// **Explicitly register bot commands**
await bot.telegram.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'balance', description: 'Check your balance' },
  { command: 'deposit', description: 'Deposit stashCoins' },
  { command: 'play', description: 'Start a dice game' },
  { command: 'withdraw', description: 'Withdraw stashCoins' },
  { command: 'referral', description: 'Referral system' },
  { command: 'admin', description: 'Admin panel' },
]);

console.log(chalk.green('✅ Bot commands registered'));

// Debugging: Log registered commands
const commands = await bot.telegram.getMyCommands();
console.log(chalk.blue('📋 Registered Commands:'), commands);


    /*// Step 3: Add General Middleware
    bot.action('clear', async (ctx) => {
      try {
        await ctx.answerCbQuery();
        await ctx.deleteMessage();
      } catch (error) {
        console.error(chalk.red('Clear action error:'), error.message);
      }
    });

    bot.catch((err, ctx) => {
      console.error(chalk.red(`Bot error (${ctx.updateType}):`), err.message);
      ctx.replyWithMarkdown('⚠️ **Error occurred!** Try again.');
    });*/

    // Step 4: Launch Bot with Polling
    console.log(chalk.blue('🔄 Launching bot using polling...'));
    await bot.launch(); // Default polling settings
    console.log(chalk.green.bold('✅ DICE GAME BOT RUNNING'));

    const botInfo = await bot.telegram.getMe();
    console.log(chalk.cyan(`🤖 Bot: @${botInfo.username} (ID: ${botInfo.id}) is active`));

    // Step 5: Start Express Server
    app.listen(PORT, () => {
      console.log(chalk.green(`✅ Server running on port ${PORT}`));
      console.log(chalk.cyan(`🌍 Webhook at: /webhooks/flutterwave`));
      console.log(chalk.cyan(`🟢 Status Check at: /status`));
    });

    // Graceful Shutdown
    process.once('SIGINT', async () => {
      console.log(chalk.yellow('⚠️ SIGINT received. Shutting down...'));
      await bot.stop('SIGINT');
      process.exit(0);
    });

    process.once('SIGTERM', async () => {
      console.log(chalk.yellow('⚠️ SIGTERM received. Shutting down...'));
      await bot.stop('SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red('❌ Fatal error during bot startup:'), error);
    process.exit(1);
  }
})();

// Error Handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
});

export { bot };
