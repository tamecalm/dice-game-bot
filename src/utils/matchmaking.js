let waitingPlayers = []; // Holds players waiting for a match

module.exports = {
  joinQueue: (player, gameMode) => {
    // Add player to the waiting queue with game mode info
    waitingPlayers.push({ ...player, gameMode });

    // Filter players with the same game mode
    const matchingPlayers = waitingPlayers.filter(p => p.gameMode === gameMode);

    // If enough players are available for the selected mode, return them and remove from queue
    if (matchingPlayers.length >= gameMode) {
      return matchingPlayers.splice(0, gameMode).map((player) => {
        waitingPlayers = waitingPlayers.filter(p => p.telegramId !== player.telegramId);
        return player;
      });
    }

    // Otherwise, return null and keep the player in queue
    return null;
  },

  leaveQueue: (playerId) => {
    // Remove the player from the queue
    waitingPlayers = waitingPlayers.filter(player => player.telegramId !== playerId);
  }
};
