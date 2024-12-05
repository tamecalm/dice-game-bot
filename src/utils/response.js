module.exports = {
  success: (ctx, message) => ctx.reply(`✅ ${message}`),
  error: (ctx, message) => ctx.reply(`❌ ${message}`),
  info: (ctx, message) => ctx.reply(`ℹ️ ${message}`)
};