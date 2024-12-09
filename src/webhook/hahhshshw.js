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

    // Log the incoming webhook event
    console.log('Incoming webhook event:', req.body);

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
            return res.status(200).send('Transaction processed successfully');
        } catch (error) {
            console.error('Error processing webhook:', error.message);
            console.error('Stack trace:', error.stack);
            return res.status(500).send('Internal server error');
        }
    }

    // Step 3: Handle unsupported or unknown events
    console.warn(`Unhandled event type: ${event}`);
    return res.status(200).send('Event ignored');
});

// Fallback route for debugging
router.use((req, res) => {
    res.status(404).send('Webhook route not found');
});

module.exports = router;



/*INcase i need to return this back to bot.js

bot.action('menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply(
        `⬅️ Back to the main menu! Choose an option:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🎮 Play', 'play'), Markup.button.callback('💰 Deposit', 'deposit')],
          [Markup.button.callback('📊 Balance', 'balance'), Markup.button.callback('🏦 Withdrawal', 'withdrawal')],
          [Markup.button.callback('👥 Referral', 'referral')], // Added 'referral' action here
        ])
      );
    } catch (error) {
      console.error('Error in back to menu handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

..............

bot.action('menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    // Welcome message with a personalized touch
    await ctx.reply(
      `**👋 Welcome back, ${ctx.from.first_name}!**\n\n` + // Personalized greeting
      `You have returned to the main menu. Choose what you'd like to do next!` + // Encouraging text
      `\n\n` +
      `*Explore the options below and make your choice:*`, // Additional stylistic choice 
         Markup.inlineKeyboard([
          [Markup.button.callback('🎮 Play', 'play'), Markup.button.callback('💰 Deposit', 'deposit')],
          [Markup.button.callback('📊 Balance', 'balance'), Markup.button.callback('🏦 Withdrawal', 'withdrawal')],
          [Markup.button.callback('👥 Referral', 'referral')] // Added 'referral' action here
        ])
    );
  } catch (error) {
    console.error('Error in back to menu handler:', error.message);
    ctx.reply('❌ An unexpected error occurred. Please try again later.');
  }
});



  */


// ..........

/*

const User = require('../../models/User');

const logError = (location, error, ctx) => {
  console.error(`Error at ${location}:`, error.message);
  if (ctx) {
    ctx.reply(`❌ Debug: Error at ${location}: ${error.message}`);
  }
};

const rollDiceForUser = async (ctx) => {
  try {
    // Send dice roll animation to user
    const diceMessage = await ctx.replyWithDice();
    const diceValue = diceMessage.dice.value;

    // Delete dice message after rolling
    setTimeout(async () => {
      await ctx.deleteMessage(diceMessage.message_id);
    }, 2000); // Wait for the dice animation to finish before deleting

    return diceValue;
  } catch (error) {
    logError('rollDiceForUser', error, ctx);
    return null;
  }
};

const rollDiceForBot = async (ctx) => {
  try {
    // Send bot's dice roll animation (hidden from user)
    const botDiceMessage = await ctx.replyWithHTML('🤖 Bot is rolling the dice...');
    const diceValue = Math.floor(Math.random() * 6) + 1; // Simulate bot's dice roll

    // Delete the bot's dice roll message after a delay
    setTimeout(async () => {
      await ctx.deleteMessage(botDiceMessage.message_id);
    }, 2000);

    return diceValue;
  } catch (error) {
    logError('rollDiceForBot', error, ctx);
    return null;
  }
};

const startGame = async (ctx, user) => {
  try {
    const betAmount = 100;
    user.balance -= betAmount;
    await user.save();

    // Inform the user about game start
    const startMessage = await ctx.replyWithHTML(`🎮 <b>Game Start!</b>\n\n👤 <b>${user.username}</b> is rolling the dice!`);
    
    // Wait for user to roll the dice
    const playerRoll = await rollDiceForUser(ctx);
    if (playerRoll === null) return;

    // Delete "Game Start" message after the user rolls
    await ctx.deleteMessage(startMessage.message_id);

    // Bot rolls the dice (hidden from user)
    const botRoll = await rollDiceForBot(ctx);
    if (botRoll === null) return;

    // Determine the result
    let resultMessage;
    if (playerRoll > botRoll) {
      resultMessage = `🎉 <b>${user.username}</b> wins with a roll of ${playerRoll} against ${botRoll}!`;
      user.balance += betAmount * 2;
      await user.save();
    } else if (botRoll > playerRoll) {
      resultMessage = `🤖 <b>Bot</b> wins with a roll of ${botRoll} against ${playerRoll}!`;
    } else {
      resultMessage = `🤝 It's a draw! Both rolled ${playerRoll}. Bet refunded.`;
      user.balance += betAmount; // Refund the bet
      await user.save();
    }

    // Send final result message with "Play Again" button
    const resultMarkup = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Play Again', callback_data: 'play' }],
        ],
      },
    };
    await ctx.replyWithHTML(resultMessage, resultMarkup);
  } catch (error) {
    logError('startGame', error, ctx);
  }
};

const playCommand = (bot) => {
  bot.action('play', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (user.balance < 100) {
        return ctx.reply('❌ Insufficient balance! You need at least 100 to play.');
      }

      await startGame(ctx, user);
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  bot.command('play', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      if (user.balance < 100) {
        return ctx.reply('❌ Insufficient balance! You need at least 100 to play.');
      }

      await startGame(ctx, user);
    } catch (error) {
      logError('playCommand', error, ctx);
    }
  });

  bot.catch((error, ctx) => {
    logError('Global Error Handler', error, ctx);
  });
};

module.exports = playCommand;
*/
