// A camera do Three.js olha ao longo de -Z; com yaw=0, W vai para -Z e D para +X.
// O vetor da direita deve rodar com a camera: (cos(yaw), -sin(yaw)).
// Esta funcao independente permite testar as 4 direcoes sem iniciar WebGL.
export function movementVector(yaw, forward, strafe, speed, dt) {
  const length = Math.hypot(forward, strafe);
  if (!length || !Number.isFinite(yaw) || !Number.isFinite(speed) || !Number.isFinite(dt)) return {dx:0,dz:0};
  const c = Math.cos(yaw), s = Math.sin(yaw), amount = speed * dt / Math.max(1,length);
  return {
    dx: (strafe*c - forward*s)*amount,
    dz: (-strafe*s - forward*c)*amount
  };
}
