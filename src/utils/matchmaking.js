let waitingPlayers = [];

module.exports = {
  joinQueue: (player) => {
    waitingPlayers.push(player);
    return waitingPlayers.length > 1 ? waitingPlayers.splice(0, 2) : null;
  },
  leaveQueue: (playerId) => {
    waitingPlayers = waitingPlayers.filter(player => player.telegramId !== playerId);
  }
};