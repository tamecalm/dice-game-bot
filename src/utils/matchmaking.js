let waitingPlayers = []; // Holds players waiting for a match

module.exports = {
  joinQueue: (player) => {
    // Add player to the waiting queue
    waitingPlayers.push(player);

    // Check if at least two players are available for a match
    if (waitingPlayers.length >= 2) {
      // Match the first two players in the queue and remove them
      const matchedPlayers = waitingPlayers.splice(0, 2);
      return matchedPlayers;
    }

    // If not enough players, keep the player in the queue
    return null;
  },

  leaveQueue: (playerId) => {
    // Remove the player from the queue
    waitingPlayers = waitingPlayers.filter(player => player.telegramId !== playerId);
  }
};
