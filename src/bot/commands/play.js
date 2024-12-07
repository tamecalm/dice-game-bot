const { joinQueue, leaveQueue } = require('../../utils/matchmaking');
const diceRoll = require('../../utils/dice');
const User = require('../../models/User');
const settings = require('../../config/settings');
const { Markup } = require('telegraf');

const playCommand = (bot) => {
    // Inline button handler for "Play" action
    bot.action('play', async (ctx) => {
        // Redirect the action to the /play command handler
        await ctx.answerCbQuery(); // Optional: Notify the user that the action is acknowledged
        await ctx.telegram.sendMessage(ctx.from.id, '🎮 Loading game setup...');
        return bot.handleUpdate({
            message: {
                ...ctx.update.callback_query.message,
                text: '/play',
            },
        });
    });

    bot.command('play', async (ctx) => {
        const telegramId = ctx.from.id;
        const username = ctx.from.username || 'Anonymous';

        try {
            // Retrieve user from database
            const user = await User.findOne({ telegramId });
            if (!user) {
                return ctx.reply('❌ You are not registered. Use /start to register.');
            }

            // Check if user is already in a game
            if (user.state === 'in-game') {
                return ctx.reply('❌ You are already in a game. Please finish the current game first.');
            }

            // Prompt user for game mode (2-player or 4-player)
            user.state = 'selecting-mode';
            await user.save();

            return ctx.reply(
                `🎮 Choose a game mode:\n\n` +
                `- 2-player: Face off against one opponent.\n` +
                `- 4-player: Battle three opponents for a bigger prize!\n`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('2 Players', 'mode_2')],
                    [Markup.button.callback('4 Players', 'mode_4')],
                ])
            );
        } catch (error) {
            console.error('Error in /play command:', error.message);
            return ctx.reply('❌ An unexpected error occurred. Please try again later.');
        }
    });

    bot.action(/mode_(\d+)/, async (ctx) => {
        const telegramId = ctx.from.id;
        const mode = parseInt(ctx.match[1], 10); // Extract game mode (2 or 4 players)

        try {
            const user = await User.findOne({ telegramId });
            if (!user || user.state !== 'selecting-mode') return;

            user.state = 'betting';
            user.gameMode = mode;
            await user.save();

            await ctx.answerCbQuery();
            return ctx.reply(
                `💰 Enter your bet amount (min: ${settings.minBet}, max: ${settings.maxBet}):\n\n` +
                `Your current balance: ${user.balance}`
            );
        } catch (error) {
            console.error('Error selecting game mode:', error.message);
            return ctx.reply('❌ An unexpected error occurred. Please try again.');
        }
    });

    // Message handler for bet input
    bot.on('message', async (ctx) => {
        const telegramId = ctx.from.id;
        const userInput = ctx.message.text;

        try {
            const user = await User.findOne({ telegramId });
            if (!user || user.state !== 'betting') return;

            const betAmount = parseFloat(userInput);

            if (isNaN(betAmount) || betAmount < settings.minBet || betAmount > settings.maxBet) {
                user.state = null;
                user.gameMode = null;
                await user.save();
                return ctx.reply(
                    `❌ Invalid bet amount. Please enter an amount between ${settings.minBet} and ${settings.maxBet}.`
                );
            }

            const vatFee = parseFloat((betAmount * settings.vatRate) / 100).toFixed(2);
            const totalBet = parseFloat(betAmount) + parseFloat(vatFee);

            if (totalBet > user.balance) {
                user.state = null;
                user.gameMode = null;
                await user.save();
                return ctx.reply(
                    `❌ Insufficient balance! Your balance: ${user.balance}. Total needed: ${totalBet}.`
                );
            }

            // Deduct bet, proceed to matchmaking
            user.balance -= totalBet;
            user.state = 'in-game';
            user.currentBet = betAmount;
            await user.save();

            ctx.reply(
                `🎲 Bet placed! Bet: ${betAmount}, VAT: ${vatFee}. Remaining balance: ${user.balance}.\n\n` +
                `⏳ Searching for opponents...`
            );

            const players = joinQueue({ telegramId, username }, user.gameMode);
            // (Continue the matchmaking and gameplay logic...)
        } catch (error) {
            console.error('Error during gameplay:', error.message);
            ctx.reply('❌ An unexpected error occurred during gameplay. Please try again later.');
        }
    });
};

module.exports = playCommand;
