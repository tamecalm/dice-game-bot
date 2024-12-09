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
