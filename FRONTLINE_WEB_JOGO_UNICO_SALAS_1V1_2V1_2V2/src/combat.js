// Shared, deterministic hit-to-damage operation for local combat.
// Visual recoil and weapon pose must never decide whether a shot deals damage.
export function applyShotDamage(hit, baseDamage) {
  if (!hit?.enemy || !hit.enemy.alive || !Number.isFinite(baseDamage) || baseDamage <= 0) return null;
  const enemy = hit.enemy;
  const damage = Math.max(0, baseDamage * (hit.multiplier ?? 1));
  const before = enemy.health;
  enemy.health = Math.max(0, before - damage);
  const killed = enemy.health === 0 && before > 0;
  if (killed) enemy.alive = false;
  return { enemy, damage, killed, head:hit.zone === 'head', zone:hit.zone };
}
