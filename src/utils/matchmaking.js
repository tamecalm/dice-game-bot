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

// utils/matchmaking.js

const waitingPlayers = []; // Holds players waiting for a match
const TIMEOUT_MS = 30000; // 30 seconds timeout

// Assuming bot is passed or imported for notifications
export default (bot) => {
  return {
    // Join the matchmaking queue
    joinQueue: (player) => {
      if (!player || !player.telegramId || !player.username) {
        console.error('Invalid player object provided to joinQueue');
        return null;
      }

      // Prevent duplicate entries
      if (waitingPlayers.some((p) => p.telegramId === player.telegramId)) {
        console.log(`DEBUG: Player ${player.username} is already in the queue.`);
        return null;
      }

      waitingPlayers.push(player);
      console.log(`DEBUG: Player ${player.username} (ID: ${player.telegramId}) joined the queue.`);

      // Check for a match
      if (waitingPlayers.length >= 2) {
        const matchedPlayers = waitingPlayers.splice(0, 2);
        console.log(
          `DEBUG: Matched players: ${matchedPlayers.map((p) => p.username).join(' vs ')}`
        );

        // Notify matched players
        matchedPlayers.forEach((p) => {
          bot.telegram.sendMessage(
            p.telegramId,
            `🎮 **Match Found!**\n\nYou’re playing against ${matchedPlayers.find((op) => op.telegramId !== p.telegramId).username}. Get ready!`,
            { parse_mode: 'Markdown' }
          ).catch((err) => console.error(`Failed to notify ${p.username}:`, err.message));
        });

        return matchedPlayers;
      }

      // Set timeout for removal if no match is found
      setTimeout(() => {
        const index = waitingPlayers.findIndex((p) => p.telegramId === player.telegramId);
        if (index !== -1) {
          waitingPlayers.splice(index, 1);
          console.log(`DEBUG: Player ${player.username} (ID: ${player.telegramId}) timed out.`);
          bot.telegram.sendMessage(
            player.telegramId,
            `⏳ **Matchmaking Timeout**\n\nNo opponent found within ${TIMEOUT_MS / 1000} seconds. Try again!`,
            { parse_mode: 'Markdown' }
          ).catch((err) => console.error(`Failed to notify ${player.username}:`, err.message));
        }
      }, TIMEOUT_MS);

      return null;
    },

    // Leave the matchmaking queue
    leaveQueue: (playerId) => {
      const playerIndex = waitingPlayers.findIndex((p) => p.telegramId === playerId);
      if (playerIndex === -1) {
        console.log(`DEBUG: Player with ID ${playerId} not found in queue.`);
        return false;
      }

      const [player] = waitingPlayers.splice(playerIndex, 1);
      console.log(`DEBUG: Player ${player.username} (ID: ${playerId}) left the queue.`);
      
      // Notify the player
      bot.telegram.sendMessage(
        playerId,
        `👋 **Left Queue**\n\nYou’ve been removed from matchmaking.`,
        { parse_mode: 'Markdown' }
      ).catch((err) => console.error(`Failed to notify ${player.username}:`, err.message));

      return true;
    },

    // Get current queue size (optional utility)
    getQueueSize: () => waitingPlayers.length,
  };
};

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
