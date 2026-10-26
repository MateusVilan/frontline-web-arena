// Directional recoil and spread, shared between client-side firing and tests.
// Tuned for a cleaner competitive feel: slightly more vertical discipline,
// a bit less erratic horizontal sway, and faster recovery on controlled bursts.
const profiles={
 m4:{rise:.00125,sway:.00090,base:.00018,move:.0028},
 ak:{rise:.00195,sway:.00128,base:.00030,move:.0032},
 mp9:{rise:.00122,sway:.00186,base:.00056,move:.0042},
 pistol:{rise:.00122,sway:.00054,base:.00018,move:.0022},
 knife:{rise:0,sway:0,base:0,move:0}
};
export function shotPattern(weapon,consecutive=0,moving=false,crouching=false){
 const p=profiles[weapon]||profiles.m4;
 const n=Math.max(0,Math.min(24,consecutive));
 const stability=crouching?.68:1;
 const mobility=moving?p.move:0;
 const discipline=1-Math.min(.18,n*.008);
 return {
  yaw:(Math.sin(n*.96)*p.sway*Math.min(n,9)*.22 +Math.sin(n*2.2)*p.base +mobility*Math.sin(n*3.7)) *stability*discipline,
  pitch:(n*p.rise*.60+mobility*Math.cos(n*2.6)*.42)*stability,
  cameraKick:(p.rise*1.32)*stability,
  resetSeconds:weapon==='pistol'?.42:.34
 };
}
