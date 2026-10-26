// Butterfly knife choreography, independent from rendering so it can be regression-tested.
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=v=>{const x=clamp(v);return x*x*(3-2*x);};
const stage=(t,a,b)=>smooth((t-a)/(b-a));
const bell=(t,a,b,c,d)=>stage(t,a,b)*(1-stage(t,c,d));
export function butterflyMotion(inspectProgress=0,drawProgress=1){
  const t=clamp(inspectProgress),draw=clamp(drawProgress);
  // Hinge axis is X: the balisong handles really rotate around their hinge,
  // rather than spinning flat around the blade as in earlier versions.
  const close=1-smooth(draw);
  const flip1=bell(t,.05,.19,.28,.42);
  const flip2=bell(t,.37,.50,.62,.76);
  const flip3=bell(t,.70,.80,.89,1);
  const strength=Math.max(0,1-close);
  const roll=Math.sin(Math.PI*6*t)*bell(t,.07,.18,.72,.98);
  return {
    handleAX:Math.PI*close + strength*(2.18*flip1-2.35*flip2+1.4*flip3),
    handleBX:-Math.PI*close + strength*(-1.94*flip1+2.10*flip2-1.66*flip3),
    handleAY:.04+strength*(.22*flip1-.19*flip2+.10*flip3),
    handleBY:-.04+strength*(-.20*flip1+.18*flip2-.10*flip3),
    rootRoll:.75*(1-smooth(draw))+.40*roll+.25*flip2-.18*flip3,
    rootYaw:.23*(1-smooth(draw))+.24*flip1-.28*flip2+.13*flip3,
    rootPitch:-.27*(1-smooth(draw))+.16*flip1-.26*flip2+.12*flip3,
    lift:-.22*(1-smooth(draw))+.035*flip1+.055*flip2,
    shift:.20*(1-smooth(draw))+.04*flip2
  };
}
