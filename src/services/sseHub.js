/**
 * sseHub — tiny in-memory Server-Sent Events broker for real-time features.
 *
 * Keyed by userId. Each user may have several open tabs/devices (a Set of
 * response objects). publish(userId, event, data) fans out to all of them.
 *
 * NOTE: This is in-process only. It works perfectly for a single Railway
 * instance (the current setup). If the app is ever scaled to multiple
 * instances, swap this for a Redis pub/sub — the public API can stay the same.
 * The frontend keeps a polling fallback, so messaging never breaks even if a
 * client's SSE connection drops.
 */

const clients = new Map(); // userId -> Set<res>

function addClient(userId, res) {
  if (!userId) return () => {};
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);

  // Remove on disconnect
  const remove = () => {
    const set = clients.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(userId);
    }
  };
  res.on('close', remove);
  return remove;
}

function writeEvent(res, event, data) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch { /* connection already gone */ }
}

/** Send an event to every open connection of a single user. */
function publish(userId, event, data) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return false;
  for (const res of set) writeEvent(res, event, data);
  return true;
}

/** Is the user currently connected (online)? */
function isOnline(userId) {
  const set = clients.get(userId);
  return !!(set && set.size > 0);
}

/** Number of distinct connected users (for diagnostics). */
function onlineCount() {
  return clients.size;
}

module.exports = { addClient, publish, isOnline, onlineCount, writeEvent };
