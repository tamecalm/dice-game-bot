const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');
const MIN_WITHDRAWAL = 100; // Updated minimum withdrawal amount
const MAX_WITHDRAWAL = 500000; // Maximum withdrawal amount
const WITHDRAWAL_FEE_PERCENTAGE = 2; // Withdrawal fee percentage
const PAYSTACK_API_KEY = process.env.PAYSTACK_API_KEY; // Paystack API Key

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

      // Check if the user is in Nigeria for bank transfer visibility
      const isNigerian = user.country && user.country.toLowerCase() === 'nigeria';

      // Display withdrawal options
      const options = [
        ...(isNigerian ? [[Markup.button.callback('🏦 Bank Transfer (NGN)', 'bank_transfer')]] : []),
        [Markup.button.callback('💸 USDT (Binance)', 'usdt')],
        [Markup.button.callback('⬅️ Back to Menu', 'menu')],
      ];

      await ctx.replyWithHTML(
        `💳 <b>Withdrawal Options</b>\n\n` +
          `Please select your preferred withdrawal method:`,
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
        `<b>Welcome back to the main menu!</b>\n\n` +
        `Choose an option below to continue.`,
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
      if (!user) return;

      user.state = `withdrawal_${method}`;
      await user.save();

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
      const userInput = ctx.message.text; // User's input from the message
      const user = await User.findOne({ telegramId });

      if (!user) {
        console.log('User not found.'); // Debug log
        return;
      }

      if (!user.state || !user.state.startsWith('withdrawal_')) {
        console.log(`No valid withdrawal state for user: ${user.state}`); // Debug log
        return;
      }

      console.log(`User state: ${user.state}`); // Debug log
      console.log(`User input: ${userInput}`); // Debug log

      const method = user.state.split('_')[1]; // Extract the withdrawal method
      const withdrawalAmount = parseFloat(userInput); // Parse the amount

      // Validate the withdrawal amount
      if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAWAL || withdrawalAmount > MAX_WITHDRAWAL) {
        console.log(`Invalid amount entered: ${withdrawalAmount}`); // Debug log
        return ctx.replyWithHTML(
          `❌ <b>Invalid amount.</b>\nPlease enter a value between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} NGN.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
          ])
        );
      }

      // Calculate fee and final amount
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

      // Save temporary withdrawal amount and advance state
      user.tempAmount = withdrawalAmount;
      user.state = `withdrawal_${method}_details`; // Update state for next step
      await user.save();
      console.log(`User state updated for details: ${user.state}`); // Debug log

      // Notify user and proceed to details collection (e.g., bank details for bank transfer)
      if (method === 'bank_transfer') {
        await ctx.replyWithHTML(
          `🏦 <b>Bank Transfer Details Required</b>\n\n` +
            `You are withdrawing <b>${finalAmount.toFixed(2)} NGN</b> (after ${WITHDRAWAL_FEE_PERCENTAGE}% fee).\n` +
            `Please provide the following details:\n\n` +
            `1. Account Name\n2. Account Number\n3. Bank Name\n\n` +
            `Type your details in the format: *Account Name, Account Number, Bank Name*`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
          ])
        );
      } else if (method === 'usdt') {
        await ctx.replyWithHTML(
          `💸 <b>USDT Withdrawal</b>\n\n` +
            `You are withdrawing <b>${finalAmount.toFixed(2)} NGN</b> (after ${WITHDRAWAL_FEE_PERCENTAGE}% fee).\n` +
            `Please provide your USDT wallet address.\n\nType your wallet address to continue.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')],
          ])
        );
      }
    } catch (error) {
      console.error('Error in withdrawal process:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });
};
