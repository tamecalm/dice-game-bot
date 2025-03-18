// Holds players waiting for a match
const waitingPlayers = new Map(); // Using Map for O(1) lookup by telegramId
const TIMEOUT_MS = 30000; // 30 seconds default timeout
const BOOSTED_TIMEOUT_MS = 15000; // 15 seconds when queue is busy
const PRIORITY_FEE = 5; // $5 for priority queue jump

// Utility to log matchmaking events
const logMatchmaking = (message, ...args) => {
  console.log(`[Matchmaking] ${message}`, ...args);
};

// Enhanced matchmaking logic
export default (bot) => {
  return {
    // Join the matchmaking queue
    joinQueue: async (player) => {
      // Validate player object
      if (!player || !player.telegramId || !player.username || typeof player.betAmount !== 'number') {
        logMatchmaking('Invalid player object provided to joinQueue', player);
        return { success: false, match: null, message: 'Invalid player data' };
      }

      const { telegramId, username, betAmount, powerUp = 'none', priority = false, currency = 'USD' } = player;

      // Check for duplicate entries
      if (waitingPlayers.has(telegramId)) {
        logMatchmaking(`Player ${username} (ID: ${telegramId}) is already in the queue`);
        return { success: false, match: null, message: 'Already in queue' };
      }

      // Handle priority fee
      if (priority) {
        const User = (await import('../../models/User.js')).default; // Dynamic import for User model
        const user = await User.findOne({ telegramId });
        if (!user || user.balance < PRIORITY_FEE) {
          logMatchmaking(`Player ${username} (ID: ${telegramId}) lacks funds for priority`);
          return { success: false, match: null, message: `Need ${PRIORITY_FEE} ${currency} for priority queue!` };
        }
        user.balance -= PRIORITY_FEE;
        const admin = await User.findOne({ telegramId: (await import('../../config/settings.js')).default.adminIds[0] });
        if (admin) {
          admin.balance += PRIORITY_FEE;
          await admin.save();
        }
        await user.save();
        logMatchmaking(`Player ${username} (ID: ${telegramId}) paid ${PRIORITY_FEE} ${currency} for priority`);
      }

      // Add player to queue with timestamp and timeout
      const playerData = {
        telegramId,
        username,
        betAmount,
        powerUp,
        currency,
        joinedAt: Date.now(),
        timeoutId: null,
        priority,
      };

      // Find a compatible match (within ±10% bet range)
      let matchedPlayer = null;
      for (const [id, p] of waitingPlayers) {
        if (id !== telegramId && Math.abs(p.betAmount - betAmount) <= betAmount * 0.1) {
          matchedPlayer = p;
          waitingPlayers.delete(id);
          clearTimeout(p.timeoutId); // Clear opponent’s timeout
          break;
        }
      }

      if (matchedPlayer) {
        // Match found, use lower bet amount for pot
        const potBet = Math.min(betAmount, matchedPlayer.betAmount);
        matchedPlayer.betAmount = potBet; // Adjust for consistency in game logic
        playerData.betAmount = potBet;
        const matchedPlayers = [matchedPlayer, playerData];
        logMatchmaking(`Matched players: ${matchedPlayers.map(p => p.username).join(' vs ')} (Pot Bet: ${potBet})`);

        // Notify matched players
        matchedPlayers.forEach((p) => {
          const opponent = matchedPlayers.find(op => op.telegramId !== p.telegramId);
          bot.telegram.sendMessage(
            p.telegramId,
            `🎮 **Match Found!**\n\nYou’re playing against **${opponent.username}**.\n` +
            `💵 Pot Bet: ${potBet} ${p.currency}\n` +
            (p.powerUp !== 'none' ? `⚡ Your Power-Up: ${p.powerUp}\n` : '') +
            (opponent.powerUp !== 'none' ? `⚡ Opponent Power-Up: ${opponent.powerUp}\n` : '') +
            `Get ready to roll!`,
            { parse_mode: 'Markdown' }
          ).catch((err) => logMatchmaking(`Failed to notify ${p.username}:`, err.message));
        });

        return { success: true, match: matchedPlayers, message: 'Match found' };
      }

      // No match found, add to queue with dynamic timeout
      const queueSizeAtBetLevel = Array.from(waitingPlayers.values())
        .filter(p => Math.abs(p.betAmount - betAmount) <= betAmount * 0.1).length;
      const timeoutDuration = queueSizeAtBetLevel > 5 ? BOOSTED_TIMEOUT_MS : TIMEOUT_MS;

      playerData.timeoutId = setTimeout(() => {
        if (waitingPlayers.has(telegramId)) {
          waitingPlayers.delete(telegramId);
          logMatchmaking(`Player ${username} (ID: ${telegramId}) timed out after ${timeoutDuration / 1000}s`);
          bot.telegram.sendMessage(
            telegramId,
            `⏳ **Matchmaking Timeout**\n\nNo opponent found for your ${betAmount} ${currency} bet within ${timeoutDuration / 1000} seconds. Try a different amount!`,
            { parse_mode: 'Markdown' }
          ).catch((err) => logMatchmaking(`Failed to notify ${username}:`, err.message));
        }
      }, timeoutDuration);

      // Add player with priority consideration (lower index = earlier matching)
      waitingPlayers.set(telegramId, playerData);
      logMatchmaking(`Player ${username} (ID: ${telegramId}) joined the queue. Bet: ${betAmount}, Power-Up: ${powerUp}, Priority: ${priority}`);

      // Notify player they’re in the queue
      let queueMessage = `⏳ **Joined Queue**\n\nLooking for an opponent near ${betAmount} ${currency}...\n` +
        (powerUp !== 'none' ? `⚡ Power-Up Selected: ${powerUp}\n` : '') +
        `Timeout in ${timeoutDuration / 1000}s.`;
      if (queueSizeAtBetLevel > 5) {
        queueMessage += `\n⚡ **Queue Busy!** Adjust your bet if no match soon!`;
      }
      bot.telegram.sendMessage(telegramId, queueMessage, { parse_mode: 'Markdown' })
        .catch((err) => logMatchmaking(`Failed to notify ${username}:`, err.message));

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