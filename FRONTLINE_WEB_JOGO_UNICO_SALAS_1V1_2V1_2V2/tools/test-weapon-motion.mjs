import assert from 'node:assert/strict';
import {addLookImpulse,relaxSway,equipDip} from '../src/weapon-motion.js';
for(const fps of [20,30,60,144]){
 const dt=1/fps;
 let state={x:0,y:0};
 for(let i=0;i<fps*2;i++){
  if(i<fps/3)state=addLookImpulse(state,22,-15);
  state=relaxSway(state,dt);
  assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.y));
  assert.ok(Math.abs(state.x)<=.12&&Math.abs(state.y)<=.09);
 }
 assert.ok(Math.abs(state.x)<.001&&Math.abs(state.y)<.001,`sway did not settle at ${fps}fps`);
 console.log('PASS camera look-sway recovery',fps,'FPS');
}
assert.equal(equipDip(0),0);
assert.ok(equipDip(.25)>.8);
assert.ok(equipDip(.1)>0 && equipDip(.1)<1);
assert.ok(Number.isFinite(addLookImpulse({x:0,y:0},NaN,Infinity).x));
console.log('PASS equip transition curve and invalid mouse inputs');
