module.exports = {
  success: (ctx, message) => ctx.reply(`✅ ${message}`),
  error: (ctx, message) => ctx.reply(`❌ ${message}`),
  info: (ctx, message, options = {}) => ctx.reply(`ℹ️ ${message}`, options),
  withButtons: (ctx, message, buttons) =>
    ctx.reply(message, {
      reply_markup: { inline_keyboard: buttons },
    }),
};
