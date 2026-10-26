// Shared, deterministic respawn-state reset for both PvP and co-op.
// The network transport sends the returned event to the affected player only.
export function respawnState(player, spawn, now = Date.now(), shieldMs = 1800) {
  if (!Array.isArray(spawn) || !Number.isFinite(spawn[0]) || !Number.isFinite(spawn[1])) {
    throw new TypeError('Invalid spawn position');
  }
  player.x = spawn[0];
  player.z = spawn[1];
  player.hp = 100;
  player.armor = 0;
  player.jump = 0;
  player.moving = false;
  player.history = [];
  player.moveCredit = .45;
  player.lastMove = now;
  player.lastCorrection = 0;
  player.spawnShield = now + shieldMs;
  return { type: 'RESPAWN', x: player.x, z: player.z, shield: shieldMs, hp: 100, armor: 0 };
}

// Only the server decides whether bot damage can pass through spawn protection.
export function canReceiveBotDamage(player, now=Date.now()) {
  return player.hp > 0 && (!Number.isFinite(player.spawnShield) || player.spawnShield <= now);
}
