const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  players: [
    {
      telegramId: { type: String, required: true },
      username: { type: String, required: true },
      roll: { type: Number, required: true }, // Dice roll result
      betAmount: { type: Number, required: true }, // Amount the player bet
    },
  ],
  winner: {
    telegramId: { type: String, required: true },
    username: { type: String, required: true },
    amountWon: { type: Number, required: true }, // Amount the winner takes home
  },
  createdAt: { type: Date, default: Date.now, index: true }, // Indexed for faster queries
});

// Indexing the schema for faster lookups and sorting
gameSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Game', gameSchema);
