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

let waitingPlayers = []; // Holds players waiting for a match
const TIMEOUT_MS = 30000; // 30 seconds timeout

module.exports = {
  joinQueue: (player) => {
    // Add player to the waiting queue
    waitingPlayers.push(player);

    console.log(`DEBUG: Player ${player.username} joined the queue.`);

    // Check if at least two players are available for a match
    if (waitingPlayers.length >= 2) {
      // Match the first two players in the queue and remove them
      const matchedPlayers = waitingPlayers.splice(0, 2);
      console.log(`DEBUG: Matched players: ${matchedPlayers.map(p => p.username).join(' vs ')}`);
      return matchedPlayers;
    }

    // Set a timeout to remove player from queue if no match is found
    setTimeout(() => {
      const index = waitingPlayers.findIndex(p => p.telegramId === player.telegramId);
      if (index !== -1) {
        waitingPlayers.splice(index, 1); // Remove player from the queue
        console.log(`DEBUG: Player ${player.username} removed from queue due to timeout.`);
      }
    }, TIMEOUT_MS);

    return null;
  },

  leaveQueue: (playerId) => {
    // Remove the player from the queue
    waitingPlayers = waitingPlayers.filter(player => player.telegramId !== playerId);
    console.log(`DEBUG: Player with ID ${playerId} left the queue.`);
  }
};


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
