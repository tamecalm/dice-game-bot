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

const gameSchema = new mongoose.Schema(
  {
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
  },
  { collection: "Dice" } // 👈 Ensuring the collection name is explicitly set to "Dice"
);

// Indexing the schema for faster lookups and sorting
gameSchema.index({ createdAt: -1 });

const Game = mongoose.model("Game", gameSchema);

export default Game;


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
