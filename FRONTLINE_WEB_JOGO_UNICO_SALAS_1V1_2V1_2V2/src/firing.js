// Relógio de tiro independente do frame rate. O saldo negativo de tempo entre
// frames é preservado para manter a cadência das armas automáticas.
export function advanceShotCooldown(timer,deltaSeconds){
 const dt=Math.max(0,Math.min(.05,Number.isFinite(deltaSeconds)?deltaSeconds:0));
 return Math.max(-.15,(Number.isFinite(timer)?timer:0)-dt);
}
export function nextShotCooldown(timer,interval){
 const delay=Math.max(.025,Number.isFinite(interval)?interval:.1);
 return Math.max(-delay,Number.isFinite(timer)?timer:0)+delay;
}
