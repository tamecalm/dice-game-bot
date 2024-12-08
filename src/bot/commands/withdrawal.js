const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');
const MIN_WITHDRAWAL = 100; // Updated minimum withdrawal amount
const MAX_WITHDRAWAL = 500000; // Maximum withdrawal amount
const WITHDRAWAL_FEE_PERCENTAGE = 2; // Withdrawal fee percentage
const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY; // Paystack API Key

module.exports = (bot) => {
  // Action handler for the withdrawal option
  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;

      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      const isNigerian = user.country && user.country.toLowerCase() === 'nigeria';

      const options = [
        ...(isNigerian ? [[Markup.button.callback('🏦 Bank Transfer (NGN)', 'bank_transfer')]] : []),
        [Markup.button.callback('💸 USDT (Binance)', 'usdt')],
        [Markup.button.callback('⬅️ Back to Menu', 'menu')],
      ];

      await ctx.replyWithHTML(
        `💳 <b>Withdrawal Options</b>\n\nPlease select your preferred withdrawal method:`,
        Markup.inlineKeyboard(options)
      );
    } catch (error) {
      console.error('Error in withdrawal handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Action handler for the "Back to Menu" button
  bot.action('menu', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.reply('❌ You are not registered. Use /start to register.');
      }

      const mainMenu = Markup.inlineKeyboard([
        [Markup.button.callback('💳 Withdrawal', 'withdrawal')],
        [Markup.button.callback('🎮 Play a Game', 'play_game')],
        [Markup.button.callback('💼 Account Settings', 'settings')],
      ]);

      await ctx.editMessageText(
        `<b>Welcome back to the main menu!</b>\n\nChoose an option below to continue.`,
        { parse_mode: 'HTML', reply_markup: mainMenu }
      );
    } catch (error) {
      console.error('Error in menu handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle withdrawal method selection
  bot.action(['bank_transfer', 'usdt'], async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const method = ctx.callbackQuery.data;

      const methods = {
        bank_transfer: '🏦 Bank Transfer (NGN)',
        usdt: '💸 USDT (Binance)',
      };

      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });
      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      user.state = `withdrawal_${method}`;
      await user.save();
      console.log(`User state updated to: ${user.state}`); // Debug log

      await ctx.replyWithHTML(
        `🔢 <b>Enter the amount you wish to withdraw (${methods[method]}):</b>\n` +
          `💰 Current Balance: ${user.balance.toFixed(2)} ${settings.defaultCurrency}\n\n` +
          `📋 <i>Note:</i>\n` +
          `- Minimum: ${MIN_WITHDRAWAL} NGN\n` +
          `- Maximum: ${MAX_WITHDRAWAL} NGN\n` +
          `- Fee: ${WITHDRAWAL_FEE_PERCENTAGE}%`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
        ])
      );
    } catch (error) {
      console.error('Error in withdrawal method selection:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle withdrawal amount input and Paystack processing
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const userInput = ctx.message.text;
      const user = await User.findOne({ telegramId });
      if (!user || !user.state || !user.state.startsWith('withdrawal_')) {
        console.log('No valid withdrawal state for user.'); // Debug log
        return;
      }

      console.log(`User input: ${userInput}`); // Debug log
      const method = user.state.split('_')[1];
      const withdrawalAmount = parseFloat(userInput);

      if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAWAL || withdrawalAmount > MAX_WITHDRAWAL) {
        console.log(`Invalid withdrawal amount: ${withdrawalAmount}`); // Debug log
        return ctx.replyWithHTML(
          `❌ <b>Invalid amount.</b>\nPlease enter a value between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} NGN.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
          ])
        );
      }

      const fee = (withdrawalAmount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
      const finalAmount = withdrawalAmount - fee;

      if (withdrawalAmount > user.balance) {
        console.log('Insufficient balance for withdrawal.'); // Debug log
        return ctx.replyWithHTML(
          `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
          ])
        );
      }

      user.tempAmount = withdrawalAmount;
      user.state = `withdrawal_${method}_details`;
      await user.save();
      console.log(`User state updated for withdrawal details: ${user.state}`); // Debug log

      if (method === 'bank_transfer') {
        const transferRecipient = {
          type: 'nuban',
          name: user.name,
          account_number: user.bankAccountNumber,
          bank_code: user.bankCode,
          currency: 'NGN',
        };

        const recipientResponse = await axios.post(
          'https://api.paystack.co/transferrecipient',
          transferRecipient,
          { headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` } }
        );

        const transfer = {
          source: 'balance',
          amount: finalAmount * 100, // Convert to kobo
          recipient: recipientResponse.data.data.recipient_code,
          reason: 'Withdrawal from Dice Game Bot',
        };

        const transferResponse = await axios.post('https://api.paystack.co/transfer', transfer, {
          headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` },
        });

        if (transferResponse.data.status) {
          user.balance -= withdrawalAmount;
          user.tempAmount = null;
          user.state = null;
          await user.save();
          console.log('Withdrawal successful.'); // Debug log

          return ctx.replyWithHTML(
            `✅ <b>Withdrawal Successful!</b>\n\n` +
              `💰 Amount: ${finalAmount.toFixed(2)} NGN (after ${WITHDRAWAL_FEE_PERCENTAGE}% fee)\n` +
              `📋 Bank Transfer via Paystack initiated successfully.`
          );
        } else {
          console.error('Paystack transfer failed:', transferResponse.data); // Debug log
          return ctx.replyWithHTML(`❌ <b>Withdrawal Failed!</b>\n\nPlease try again later.`);
        }
      }
    } catch (error) {
      console.error('Error in withdrawal process:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
