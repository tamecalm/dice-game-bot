const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  players: [
    {
      telegramId: String,
      username: String,
      roll: Number,
      betAmount: Number
    }
  ],
  winner: {
    telegramId: String,
    username: String,
    amountWon: Number
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);