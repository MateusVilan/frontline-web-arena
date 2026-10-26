// Progressão contínua da passada: alternar Shift nunca altera instantaneamente a fase.
// Mantém a animação independente do tempo total desde que o jogo começou.
export function advanceGait(state, dt, moving, sprinting) {
 const safeDt = Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0));
 const moveTarget = moving ? 1 : 0;
 const sprintTarget = moving && sprinting ? 1 : 0;
 const easedMovement = 1 - Math.exp(-safeDt * 13);
 const easedSprint = 1 - Math.exp(-safeDt * 9);
 const motion = state.motion + (moveTarget - state.motion) * easedMovement;
 const sprint = state.sprint + (sprintTarget - state.sprint) * easedSprint;
 const frequency = 8.2 + 3.2 * sprint;
 // Parado, a arma pára suavemente no ponto em que a passada ficou.
 const phase = (state.phase + safeDt * frequency * motion) % (Math.PI * 2);
 return { phase, motion, sprint, frequency };
}
