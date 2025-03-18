import mongoose from 'mongoose';

const GameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  opponentId: { type: String }, // For PvP
  betAmount: { type: Number, required: true },
  playerRoll: { type: Number, required: true },
  botRoll: { type: Number, required: true }, // Used as opponent roll in PvP
  outcome: { type: String, enum: ['win', 'loss', 'tie'], required: true },
  winnings: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['easy', 'normal', 'hard'], optional: true },
  powerUp: { type: String, enum: ['reroll', 'shield', 'boost'], optional: true },
  opponentPowerUp: { type: String, enum: ['reroll', 'shield', 'boost'], optional: true }, // For PvP
  ladderTier: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('Game', GameSchema);