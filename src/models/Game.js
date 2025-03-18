import mongoose from 'mongoose';

const GameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  userId: { type: String, required: true }, // Telegram ID
  betAmount: { type: Number, required: true },
  playerRoll: { type: Number, required: true },
  botRoll: { type: Number, required: true },
  outcome: { type: String, enum: ['win', 'loss', 'tie'], required: true },
  winnings: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['easy', 'normal', 'hard'], default: 'normal' },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('Game', GameSchema);