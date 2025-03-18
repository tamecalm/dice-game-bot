// ==========================================================================
// Dice Game Bot Project - Script Header
// ==========================================================================
//
// Project: Dice Game Bot
// Repository: https://github.com/tamecalm/dice-game-bot
// 
// Description: 
// A robust and extensible module designed for a multiplayer dice game bot. 
// Feel free to use, modify, or contribute to the project under the terms of the repository's license.
//
// Author: Engr John! 🧑‍💻
// Year: 2024
// 
// License: Licensed under the terms of the repository's license. Unauthorized duplication, 
// Modification, or distribution of this script outside the license terms is prohibited.
// ==========================================================================

import express from 'express'; // ES6 import
import User from '../models/User.js'; // ES6 import
import crypto from 'crypto'; // ES6 import
import bodyParser from 'body-parser'; // ES6 import
// import { bot} from '../../Initialization/app.js'; // Import the bot instance

const router = express.Router();

// Verify Flutterwave webhook signature
const verifySignature = (req, secret) => {
  const hash = crypto
    .createHmac('sha256', secret) // Flutterwave uses SHA256
    .update(JSON.stringify(req.body))
    .digest('hex');
  return hash === req.headers['verif-hash']; // Flutterwave uses 'verif-hash' header
};

// Webhook route
router.post('/flutterwave-webhook', bodyParser.json(), async (req, res) => {
  const secret = process.env.FLW_SECRET_KEY || settings.flutterwaveSecretKey;

  // Log incoming webhook event
  console.log('Incoming Flutterwave webhook event:', req.body);

  // Step 1: Verify the webhook signature
  if (!verifySignature(req, secret)) {
    console.error('Invalid Flutterwave webhook signature');
    return res.status(400).send('Invalid signature');
  }

  const { event, data } = req.body;

  try {
    // Step 2: Handle successful payment (Deposit)
    if (event === 'charge.completed' && data.status === 'successful') {
      const userId = data.meta?.userId; // Metadata contains userId from deposit.js
      const currency = data.currency;
      const vatFee = parseFloat(data.meta?.vatFee || 0); // VAT fee from metadata
      const totalAmount = data.amount; // Already in major currency unit
      const depositAmount = totalAmount - vatFee;

      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return res.status(404).send('User not found');
      }

      // Update user's balance and deposit stats
      user.balance += depositAmount;
      user.totalDeposits += depositAmount;
      if (!user.firstDeposit) user.firstDeposit = new Date();
      await user.save();

      console.log(
        `Deposit of ${currency} ${depositAmount} (after VAT ${currency} ${vatFee}) credited to user ${userId}`
      );

      // Send confirmation to user
      const successMessage = `✅ **Deposit Confirmed**\n\n` +
        `💰 ${currency} ${depositAmount} credited (after VAT ${currency} ${vatFee}).\n` +
        `🔹 New Balance: ${currency} ${user.balance.toFixed(2)}`;
      await bot.telegram.sendMessage(userId, successMessage, { parse_mode: 'Markdown' });

      return res.status(200).send('Deposit processed successfully');
    }

    // Step 3: Handle successful transfer (Withdrawal)
    if (event === 'transfer.completed' && data.status === 'SUCCESSFUL') {
      const userId = data.meta?.userId; // Assume metadata includes userId from withdrawal.js
      const amount = data.amount; // Already in major currency unit
      const currency = data.currency;

      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return res.status(404).send('User not found');
      }

      // Update user balance
      user.balance -= amount;
      user.tempAmount = null; // Clear temp amount if used
      await user.save();

      console.log(`Withdrawal of ${currency} ${amount} confirmed for user ${userId}`);

      // Notify the user
      const withdrawalMessage = `✅ **Withdrawal Processed**\n\n` +
        `🏦 ${currency} ${amount} sent successfully.\n` +
        `🔹 New Balance: ${currency} ${user.balance.toFixed(2)}`;
      await bot.telegram.sendMessage(userId, withdrawalMessage, { parse_mode: 'Markdown' });

      return res.status(200).send('Withdrawal processed successfully');
    }

    // Step 4: Handle failed transfer (Withdrawal)
    if (event === 'transfer.completed' && data.status === 'FAILED') {
      const userId = data.meta?.userId;
      const reason = data.complete_message || 'Unknown reason';

      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return res.status(404).send('User not found');
      }

      console.error(`Withdrawal for user ${userId} failed: ${reason}`);

      // Notify the user
      const failedMessage = `❌ **Withdrawal Failed**\n\n` +
        `Reason: ${reason}\n` +
        `Please try again or contact support.`;
      await bot.telegram.sendMessage(userId, failedMessage, { parse_mode: 'Markdown' });

      return res.status(200).send('Failed withdrawal handled');
    }

    // Step 5: Handle unsupported events
    console.warn(`Unhandled event type: ${event}`);
    return res.status(200).send('Event ignored');
  } catch (error) {
    console.error('Error processing webhook:', error.message);
    return res.status(500).send('Internal server error');
  }
});

// Fallback route for debugging
router.use((req, res) => {
  res.status(404).send('Webhook route not found');
});

export default router;

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================


/*

// src/webhook/webhook.js (partial example)
import User from '../models/User.js'; // Adjust path

const REFERRAL_PERCENTAGE = 20; // Move to config if shared
const MIN_DEPOSIT = 500;

export default async (req, res) => {
  const { bot } = req; // Assuming bot is passed via middleware in app.js
  const { event, data } = req.body;

  if (event === 'charge.completed' && data.status === 'successful') {
    const userId = data.meta?.userId;
    const currency = data.currency;
    const vatFee = parseFloat(data.meta?.vatFee || 0);
    const totalAmount = data.amount;
    const depositAmount = totalAmount - vatFee;

    try {
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        console.error(`User with ID ${userId} not found`);
        return res.status(404).send('User not found');
      }

      user.balance += depositAmount;
      user.totalDeposits += depositAmount;
      if (!user.firstDeposit) user.firstDeposit = new Date();
      await user.save();

      // Handle referral reward
      if (user.referredBy && !user.firstDeposit && depositAmount >= MIN_DEPOSIT) {
        const referrer = await User.findOne({ referralCode: user.referredBy });
        if (referrer) {
          const reward = (depositAmount * REFERRAL_PERCENTAGE) / 100;
          referrer.referralEarnings += reward;
          referrer.balance += reward;
          await referrer.save();

          await bot.telegram.sendMessage(
            referrer.telegramId,
            `💰 **Referral Bonus!**\n\n` +
              `🎉 You earned ${reward.toFixed(2)} ${currency} from a referral’s deposit of ${depositAmount} ${currency}!`,
            { parse_mode: 'Markdown' }
          );
        }
      }

      await bot.telegram.sendMessage(
        userId,
        `✅ **Deposit Successful!**\n\n` +
          `💳 **Amount:** ${depositAmount.toFixed(2)} ${currency}\n` +
          `💰 **New Balance:** ${user.balance.toFixed(2)} ${currency}`,
        { parse_mode: 'Markdown' }
      );

      return res.status(200).send('Webhook processed successfully');
    } catch (error) {
      console.error('Error processing webhook:', error.message);
      return res.status(500).send('Internal server error');
    }
  }

  return res.status(200).send('Event ignored');
};

*/