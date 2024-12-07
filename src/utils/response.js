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
