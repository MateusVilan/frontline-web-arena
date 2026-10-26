// Lightweight camera-relative weapon sway; never affects ballistic direction.
// Pure helpers make mouse-motion, frame-rate and equip transitions testable.
export const clampMotion=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export function addLookImpulse(state,deltaX,deltaY,sensitivity=.00215){
 const dx=Number.isFinite(deltaX)?clampMotion(deltaX,-125,125):0;
 const dy=Number.isFinite(deltaY)?clampMotion(deltaY,-125,125):0;
 const s=Number.isFinite(sensitivity)?clampMotion(sensitivity,.0003,.01):.00215;
 return {
  x:clampMotion(state.x+dx*s*.30,-.12,.12),
  y:clampMotion(state.y+dy*s*.25,-.09,.09)
 };
}
export function relaxSway(state,dt){
 const t=clampMotion(Number.isFinite(dt)?dt:0,0,.05);
 const amount=Math.exp(-t*12);
 return {x:state.x*amount,y:state.y*amount};
}
export function equipDip(remaining,duration=.28){
 if(!Number.isFinite(remaining)||remaining<=0)return 0;
 const t=clampMotion(remaining/Math.max(.1,duration),0,1);
 return t*t*(3-2*t);
}
