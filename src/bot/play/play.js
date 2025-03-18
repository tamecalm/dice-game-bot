import { Markup } from 'telegraf';
import playPvC from '../gameModes/playPvC.js'; // Ensure this file exists and exports a function
import playPvP from '../gameModes/playPvP.js'; // Ensure this file exists and exports a function

// Reusable function to send game mode selection
const getPlayMessage = async (ctx) => {
  try {
    console.log(`📩 /play command received from: ${ctx.from?.id} (${ctx.from?.username})`);
    
    const text = `🎲 **Choose Your Game Mode**\n\nPick how you’d like to play:`;
    const options = {
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('🤖 Vs Computer', 'play_pvc')],
          [Markup.button.callback('👥 Vs Player', 'play_pvp')],
        ],
      },
    };

    console.log(`✅ Prepared game mode selection for ${ctx.from?.id}`);
    return { text, options };
  } catch (error) {
    console.error('❌ Error preparing play message:', error);
    return {
      text: '⚠️ Something went wrong. Try again later.',
      options: null,
    };
  }
};

export function setupPlay(bot) {
  // Command handler for "/play"
  bot.command('play', async (ctx) => {
    console.log(`🔧 Executing /play command for ${ctx.from?.id}`);
    const { text, options } = await getPlayMessage(ctx);
    await ctx.replyWithMarkdown(text, options);
  });

  // Inline button handler for "Vs Computer"
  bot.action('play_pvc', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      console.log(`▶️ Starting PvC for ${ctx.from?.id}`);
      await playPvC(ctx); // Call the PvC handler
    } catch (error) {
      console.error('❌ Error in play_pvc action:', error);
      await ctx.reply('⚠️ Something went wrong in PvC mode.');
    }
  });

  // Inline button handler for "Vs Player"
  bot.action('play_pvp', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      console.log(`▶️ Starting PvP for ${ctx.from?.id}`);
      await playPvP(ctx); // Call the PvP handler
    } catch (error) {
      console.error('❌ Error in play_pvp action:', error);
      await ctx.reply('⚠️ Something went wrong in PvP mode.');
    }
  });
}

export default setupPlay;