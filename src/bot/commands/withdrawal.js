const { Markup } = require('telegraf');
const axios = require('axios');
const User = require('../../models/User');
const settings = require('../../config/settings');
const MIN_WITHDRAWAL = 100; // Updated minimum withdrawal amount
const MAX_WITHDRAWAL = 500000; // Maximum withdrawal amount
const WITHDRAWAL_FEE_PERCENTAGE = 2; // Withdrawal fee percentage
const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY; // Paystack API Key

module.exports = (bot) => {
  // Withdrawal action handler
  bot.action('withdrawal', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramId = ctx.from.id;
      const user = await User.findOne({ telegramId });

      if (!user) {
        return ctx.replyWithHTML('❌ <b>You are not registered.</b>\nUse /start to register.');
      }

      await ctx.replyWithHTML(
        `💳 <b>Withdrawal - Bank Transfer (NGN)</b>\n\nPlease provide your bank account details to proceed.\n` +
        `Format: <code>AccountNumber,BankCode</code>`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Menu', 'menu')]])
      );

      user.state = 'withdrawal_bank_details';
      await user.save();
    } catch (error) {
      console.error('Error in withdrawal handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Back to menu button handler
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
        { parse_mode: 'HTML', reply_markup: mainMenu.reply_markup }
      );
    } catch (error) {
      console.error('Error in menu handler:', error.message);
      ctx.reply('❌ An unexpected error occurred. Please try again later.');
    }
  });

  // Handle withdrawal bank details
  bot.on('message', async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const userInput = ctx.message.text;
      const user = await User.findOne({ telegramId });

      if (!user || !user.state || !user.state.startsWith('withdrawal_')) {
        return;
      }

      if (user.state === 'withdrawal_bank_details') {
        const [accountNumber, bankCode] = userInput.split(',').map((val) => val.trim());

        if (!accountNumber || !bankCode) {
          return ctx.replyWithHTML(
            '❌ <b>Invalid format.</b>\nPlease send details as: <code>AccountNumber,BankCode</code>'
          );
        }

        const bankVerificationResponse = await axios.get(
          `https://api.paystack.co/bank/resolve`,
          {
            headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` },
            params: { account_number: accountNumber, bank_code: bankCode },
          }
        );

        if (!bankVerificationResponse.data.status) {
          return ctx.replyWithHTML('❌ <b>Bank details verification failed.</b>\nPlease check your details and try again.');
        }

        const { account_name: accountName, bank_name: bankName } = bankVerificationResponse.data.data;
        user.bankAccountNumber = accountNumber;
        user.bankCode = bankCode;
        user.bankName = bankName;
        user.state = 'withdrawal_amount';
        await user.save();

        return ctx.replyWithHTML(
          `✅ <b>Bank details verified:</b>\n- Account Name: ${accountName}\n- Bank: ${bankName}\n\n` +
          `🔢 <b>Enter the amount you wish to withdraw:</b>\n` +
          `💰 Current Balance: ${user.balance.toFixed(2)} ${settings.defaultCurrency}\n\n` +
          `📋 <i>Note:</i>\n- Minimum: ${MIN_WITHDRAWAL} NGN\n- Maximum: ${MAX_WITHDRAWAL} NGN\n- Fee: ${WITHDRAWAL_FEE_PERCENTAGE}%`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')]])
        );
      }

      if (user.state === 'withdrawal_amount') {
        const withdrawalAmount = parseFloat(userInput);

        if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAWAL || withdrawalAmount > MAX_WITHDRAWAL) {
          return ctx.replyWithHTML(
            `❌ <b>Invalid amount.</b>\nPlease enter a value between ${MIN_WITHDRAWAL} and ${MAX_WITHDRAWAL} NGN.`,
            Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')]])
          );
        }

        const fee = (withdrawalAmount * WITHDRAWAL_FEE_PERCENTAGE) / 100;
        const finalAmount = withdrawalAmount - fee;

        if (withdrawalAmount > user.balance) {
          return ctx.replyWithHTML(
            `❌ <b>Insufficient balance.</b>\nYour balance is ${user.balance.toFixed(2)} NGN.`,
            Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Withdrawal Methods', 'withdrawal')]])
          );
        }

        const withdrawalId = `WD-${Date.now()}`;
        user.tempAmount = withdrawalAmount;
        user.state = null;
        user.balance -= withdrawalAmount;
        await user.save();

        // Simulate successful transfer
        console.log(`Simulating withdrawal for ID: ${withdrawalId}, Amount: ${finalAmount}`);

        return ctx.replyWithHTML(
          `✅ <b>Withdrawal Successful!</b>\n\n` +
          `💰 Amount: ${finalAmount.toFixed(2)} NGN (after ${WITHDRAWAL_FEE_PERCENTAGE}% fee)\n` +
          `📋 Bank Transfer ID: ${withdrawalId}\n\nThank you for using our service!`
        );
      }
    } catch (error) {
      console.error('Error in withdrawal process:', error.message);
      ctx.reply(`❌ An unexpected error occurred: ${error.message}`);
    }
  });
};
