const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  telegramId: { type: String, required: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Admin', adminSchema);