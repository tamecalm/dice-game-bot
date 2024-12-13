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

module.exports = {
  success: (ctx, message) =>
    ctx.reply(`✅ ${message}`, { parse_mode: 'MarkdownV2' }),

  error: (ctx, message) =>
    ctx.reply(`❌ ${message}`, { parse_mode: 'MarkdownV2' }),

  info: (ctx, message, options = {}) =>
    ctx.reply(`ℹ️ ${message}`, { parse_mode: 'MarkdownV2', ...options }),

  withButtons: (ctx, message, buttons) =>
    ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: buttons },
    }),

  markdown: (ctx, message, options = {}) =>
    ctx.reply(message, { parse_mode: 'MarkdownV2', ...options }),

  html: (ctx, message, options = {}) =>
    ctx.reply(message, { parse_mode: 'HTML', ...options }),
};


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
