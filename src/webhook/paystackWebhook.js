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

const express = require('express');
const User = require('../models/User');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const bot = require('../bot/commands/bot'); // Import the bot instance

const router = express.Router();

// Verify Paystack webhook signature
function verifySignature(req, secret) {
    const hash = crypto
        .createHmac('sha512', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
    return hash === req.headers['x-paystack-signature'];
}

// Webhook route
router.post('/paystack-webhook', bodyParser.json(), async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Log the incoming webhook event
    console.log('Incoming webhook event:', req.body);

    // Step 1: Verify the webhook signature
    if (!verifySignature(req, secret)) {
        console.error('Invalid Paystack webhook signature');
        return res.status(400).send('Invalid signature');
    }

    const { event, data } = req.body;

    try {
        // Step 2: Handle `charge.success` (Deposit) event
        if (event === 'charge.success') {
            const userId = data.metadata.userId; // Metadata contains userId from the transaction
            const currency = data.currency; // Currency used for the transaction
            const vatFee = parseFloat(data.metadata.vatFee || 0); // VAT fee from metadata, default to 0 if missing

            // Calculate the actual deposit amount after VAT
            const totalAmount = data.amount / 100; // Convert to major currency unit
            const depositAmount = totalAmount - vatFee;

            // Find the user in the database
            const user = await User.findOne({ telegramId: userId });
            if (!user) {
                console.error(`User with ID ${userId} not found.`);
                return res.status(404).send('User not found');
            }

            // Update user's balance
            user.balance += depositAmount; // Add only the deposit amount (after VAT)
            await user.save();

            console.log(
                `Deposit of ${currency} ${depositAmount} (after VAT ${currency} ${vatFee}) credited to user ${userId}`
            );

            // Send confirmation message to user on Telegram
            const successMessage = `Your account has been credited with ${currency} ${depositAmount} after a VAT of ${currency} ${vatFee}. Your new balance is ${currency} ${user.balance}.`;
            await bot.telegram.sendMessage(userId, successMessage);

            return res.status(200).send('Transaction processed successfully');
        }

        // Step 3: Handle `transfer.success` (Withdrawal) event
        if (event === 'transfer.success') {
            const { recipient, amount, reference } = data; // Paystack transfer data
            const user = await User.findOne({ bankAccountNumber: recipient.account_number });

            if (!user) {
                console.error(`User with account number ${recipient.account_number} not found.`);
                return res.status(404).send('User not found');
            }

            // Mark withdrawal as successful
            user.balance -= amount / 100; // Deduct the withdrawn amount
            user.tempAmount = null; // Clear temporary amount, if any
            await user.save();

            console.log(`Withdrawal of ${amount / 100} confirmed for user ${user.telegramId}`);

            // Notify the user
            const withdrawalMessage = `Your withdrawal of NGN ${amount / 100} has been successfully processed. Your new balance is NGN ${user.balance.toFixed(2)}.`;
            await bot.telegram.sendMessage(user.telegramId, withdrawalMessage);

            return res.status(200).send('Withdrawal processed successfully');
        }

        // Step 4: Handle `transfer.failed` (Failed Withdrawal) event
        if (event === 'transfer.failed') {
            const { recipient, reason } = data;
            const user = await User.findOne({ bankAccountNumber: recipient.account_number });

            if (!user) {
                console.error(`User with account number ${recipient.account_number} not found.`);
                return res.status(404).send('User not found');
            }

            console.error(`Withdrawal for user ${user.telegramId} failed: ${reason}`);

            // Notify the user
            const failedMessage = `Your withdrawal request failed. Reason: ${reason}. Please try again or contact support.`;
            await bot.telegram.sendMessage(user.telegramId, failedMessage);

            return res.status(200).send('Failed withdrawal handled');
        }

        // Step 5: Handle unsupported or unknown events
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

module.exports = router;


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
