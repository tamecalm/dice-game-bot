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

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true },
    username: { type: String },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "NGN" },
    totalDeposits: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    country: { type: String }, // New field to store the user's country
    referralCode: { type: String },
    referredBy: { type: String }, // User ID of the referrer, if applicable
    state: { type: String }, // Track current user state (e.g., 'withdrawing', 'depositing')
    tempAmount: { type: Number }, // Temporary amount for withdrawals
    usdtAddress: { type: String }, // User's USDT address
    referralEarnings: { type: Number, default: 0 }, // Total referral earnings
    lastLogin: { type: Date }, // Last login timestamp
    firstDeposit: { type: Date }, // First deposit timestamp (used for referral rewards)
  },
  { collection: "Dice" } // 👈 Ensuring the collection name is explicitly set to "Dice"
);

const User = mongoose.model("User", userSchema);

export default User;


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
