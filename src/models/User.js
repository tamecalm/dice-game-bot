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

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true },
    username: { type: String },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: '$' },
    totalDeposits: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    country: { type: String },
    referralCode: { type: String },
    referredBy: { type: String },
    state: { type: String },
    tempAmount: { type: Number },
    usdtAddress: { type: String },
    referralEarnings: { type: Number, default: 0 },
    lastLogin: { type: Date },
    firstDeposit: { type: Date },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    ties: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    lossStreak: { type: Number, default: 0 },
    rivalryScore: { type: Map, of: Number, default: () => ({}) },
    highRollerCount: { type: Number, default: 0 },
    weeklyWins: { type: Number, default: 0 },
    dailyWins: { type: Number, default: 0 }, // New field for daily leaderboard
  },
  { collection: 'Dice' }
);

export default mongoose.model('User', userSchema);

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
