const express = require('express');
const User = require('../models/User');
const crypto = require('crypto');
const bodyParser = require('body-parser');

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

    // Step 1: Verify the webhook signature
    if (!verifySignature(req, secret)) {
        console.error('Invalid Paystack webhook signature');
        return res.status(400).send('Invalid signature');
    }

    const { event, data } = req.body;

    // Step 2: Handle charge.success event
    if (event === 'charge.success') {
        try {
            const userId = data.metadata.userId; // Metadata contains userId from the transaction
            const currency = data.currency; // Currency used for the transaction
            const vatFee = parseFloat(data.metadata.vatFee); // VAT fee from metadata

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
            return res.status(200).send('Transaction processed successfully');
        } catch (error) {
            console.error('Error processing webhook:', error);
            return res.status(500).send('Internal server error');
        }
    }

    // Step 3: Handle unsupported or unknown events
    console.warn(`Unhandled event type: ${event}`);
    return res.status(200).send('Event ignored');
});

module.exports = router;