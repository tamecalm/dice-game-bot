// Holds players waiting for a match
const waitingPlayers = new Map(); // Using Map for O(1) lookup by telegramId
const TIMEOUT_MS = 30000; // 30 seconds timeout

// Utility to log matchmaking events
const logMatchmaking = (message, ...args) => {
  console.log(`[Matchmaking] ${message}`, ...args);
};

// Enhanced matchmaking logic
export default (bot) => {
  return {
    // Join the matchmaking queue
    joinQueue: (player) => {
      // Validate player object
      if (!player || !player.telegramId || !player.username || typeof player.betAmount !== 'number') {
        logMatchmaking('Invalid player object provided to joinQueue', player);
        return { success: false, match: null, message: 'Invalid player data' };
      }

      const { telegramId, username, betAmount, powerUp = 'none' } = player;

      // Check for duplicate entries
      if (waitingPlayers.has(telegramId)) {
        logMatchmaking(`Player ${username} (ID: ${telegramId}) is already in the queue`);
        return { success: false, match: null, message: 'Already in queue' };
      }

      // Add player to queue with timestamp and timeout
      const playerData = {
        telegramId,
        username,
        betAmount,
        powerUp,
        joinedAt: Date.now(),
        timeoutId: null,
      };

      // Find a compatible match (same betAmount)
      let matchedPlayer = null;
      for (const [id, p] of waitingPlayers) {
        if (id !== telegramId && p.betAmount === betAmount) {
          matchedPlayer = p;
          waitingPlayers.delete(id);
          clearTimeout(p.timeoutId); // Clear opponent’s timeout
          break;
        }
      }

      if (matchedPlayer) {
        // Match found
        const matchedPlayers = [matchedPlayer, playerData];
        logMatchmaking(`Matched players: ${matchedPlayers.map(p => p.username).join(' vs ')} (Bet: ${betAmount})`);

        // Notify matched players
        matchedPlayers.forEach((p) => {
          const opponent = matchedPlayers.find(op => op.telegramId !== p.telegramId);
          bot.telegram.sendMessage(
            p.telegramId,
            `🎮 **Match Found!**\n\nYou’re playing against **${opponent.username}**.\n` +
            `💵 Bet: ${betAmount} ${p.currency || 'currency'}\n` +
            (p.powerUp !== 'none' ? `⚡ Your Power-Up: ${p.powerUp}\n` : '') +
            (opponent.powerUp !== 'none' ? `⚡ Opponent Power-Up: ${opponent.powerUp}\n` : '') +
            `Get ready to roll!`,
            { parse_mode: 'Markdown' }
          ).catch((err) => logMatchmaking(`Failed to notify ${p.username}:`, err.message));
        });

        return { success: true, match: matchedPlayers, message: 'Match found' };
      }

      // No match found, add to queue
      playerData.timeoutId = setTimeout(() => {
        if (waitingPlayers.has(telegramId)) {
          waitingPlayers.delete(telegramId);
          logMatchmaking(`Player ${username} (ID: ${telegramId}) timed out after ${TIMEOUT_MS / 1000}s`);
          bot.telegram.sendMessage(
            telegramId,
            `⏳ **Matchmaking Timeout**\n\nNo opponent found for your ${betAmount} bet within ${TIMEOUT_MS / 1000} seconds. Try again!`,
            { parse_mode: 'Markdown' }
          ).catch((err) => logMatchmaking(`Failed to notify ${username}:`, err.message));
        }
      }, TIMEOUT_MS);

      waitingPlayers.set(telegramId, playerData);
      logMatchmaking(`Player ${username} (ID: ${telegramId}) joined the queue. Bet: ${betAmount}, Power-Up: ${powerUp}`);

      // Notify player they’re in the queue
      bot.telegram.sendMessage(
        telegramId,
        `⏳ **Joined Queue**\n\nLooking for an opponent with a ${betAmount} bet...\n` +
        (powerUp !== 'none' ? `⚡ Power-Up Selected: ${powerUp}\n` : '') +
        `You’ll be matched soon or timed out in ${TIMEOUT_MS / 1000}s.`,
        { parse_mode: 'Markdown' }
      ).catch((err) => logMatchmaking(`Failed to notify ${username}:`, err.message));

      return { success: true, match: null, message: 'Added to queue' };
    },

    // Leave the matchmaking queue
    leaveQueue: (telegramId) => {
      const player = waitingPlayers.get(telegramId);
      if (!player) {
        logMatchmaking(`Player with ID ${telegramId} not found in queue`);
        return { success: false, message: 'Not in queue' };
      }

      clearTimeout(player.timeoutId);
      waitingPlayers.delete(telegramId);
      logMatchmaking(`Player ${player.username} (ID: ${telegramId}) left the queue`);

      // Notify the player
      bot.telegram.sendMessage(
        telegramId,
        `👋 **Left Queue**\n\nYou’ve been removed from matchmaking.`,
        { parse_mode: 'Markdown' }
      ).catch((err) => logMatchmaking(`Failed to notify ${player.username}:`, err.message));

      return { success: true, message: 'Left queue' };
    },

    // Get current queue status
    getQueueStatus: () => {
      const queueSize = waitingPlayers.size;
      const byBetAmount = Array.from(waitingPlayers.values()).reduce((acc, p) => {
        acc[p.betAmount] = (acc[p.betAmount] || 0) + 1;
        return acc;
      }, {});
      logMatchmaking(`Queue status: ${queueSize} players`, byBetAmount);
      return { size: queueSize, byBetAmount };
    },

    // Clear queue (for cleanup or reset)
    clearQueue: () => {
      waitingPlayers.forEach((player) => clearTimeout(player.timeoutId));
      waitingPlayers.clear();
      logMatchmaking('Queue cleared');
      return { success: true, message: 'Queue cleared' };
    },

    // Check if player is in queue (utility)
    isInQueue: (telegramId) => {
      return waitingPlayers.has(telegramId);
    },
  };
};

// Cleanup on process exit (optional)
process.on('SIGINT', () => {
  waitingPlayers.forEach((player) => clearTimeout(player.timeoutId));
  waitingPlayers.clear();
  logMatchmaking('Matchmaking queue cleared on shutdown');
  process.exit();
});