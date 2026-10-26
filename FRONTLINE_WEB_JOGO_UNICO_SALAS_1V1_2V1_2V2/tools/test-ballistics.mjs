import assert from 'node:assert/strict';
import {shotPattern} from '../src/ballistics.js';
for(const gun of ['m4','ak','mp9','pistol','knife']){
 const first=shotPattern(gun,0,false,false);
 const repeated=shotPattern(gun,10,false,false);
 const moving=shotPattern(gun,10,true,false);
 const crouching=shotPattern(gun,10,false,true);
 for(const p of [first,repeated,moving,crouching]){
  assert.ok(Number.isFinite(p.yaw)&&Number.isFinite(p.pitch));
  assert.ok(Math.abs(p.yaw)<.035&&Math.abs(p.pitch)<.035);
 }
 if(gun!=='knife')assert.ok(repeated.pitch>first.pitch,gun);
 assert.ok(Math.abs(crouching.yaw)<=Math.abs(repeated.yaw)+1e-9);
 assert.ok(moving.resetSeconds>0);
}
console.log('PASS recoil: all guns bounded, predictable burst, crouching stabilization');
