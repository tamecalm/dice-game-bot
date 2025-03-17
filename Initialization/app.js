// app.js
import express from 'express';
import bot from './bot.js'; // Ensure bot file uses ES6 export
import connectDb from '../src/database/db.js';
import settings from '../src/config/settings.js';
import flutterwaveWebhook from '../src/webhook/webhook.js';

// Initialize the Express app
const app = express();

// Middleware setup
app.use(express.json()); // To parse JSON requests (e.g., Flutterwave webhooks)

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// Define routes
app.use('/webhook/flutterwave', flutterwaveWebhook); // Scoped webhook for Flutterwave

// Telegram webhook route (optional, uncomment if using webhooks)
// app.post('/webhook/telegram', (req, res) => {
//   bot.handleUpdate(req.body);
//   res.sendStatus(200);
// });

// Test route for debugging
app.get('/test', (req, res) => {
  res.send('Server is running');
});

// Async function to start the app
const startApp = async () => {
  try {
    // Connect to the database
    await connectDb();
    console.log('📦 Database connected successfully');

    // Option 1: Use polling (default, works locally)
    await bot.launch();
    console.log('🤖 Bot is running with polling');

    // Option 2: Use webhook (uncomment to use instead of polling)
    // const webhookUrl = `${settings.baseUrl}/webhook/telegram`;
    // await bot.telegram.setWebhook(webhookUrl);
    // console.log(`🤖 Bot webhook set to ${webhookUrl}`);

  } catch (error) {
    console.error('❌ Error starting app:', error.message);
    process.exit(1);
  }
};

// Start the app
startApp();

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
  bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});