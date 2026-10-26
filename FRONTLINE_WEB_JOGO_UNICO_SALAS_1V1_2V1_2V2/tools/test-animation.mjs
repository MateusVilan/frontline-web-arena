import assert from 'node:assert/strict';
import {weaponPose, enemyMotion} from '../src/animation.js';
for(const weapon of ['m4','ak','pistol','mp9','knife']){
 const idle=weaponPose(weapon);
 assert(Object.values(idle).every(x=>Number.isFinite(x)));
 const reload=weaponPose(weapon,0,.4,0);
 assert(reload.reloadStrength>.9);
 const look=weaponPose(weapon,.5,0,0);
 assert(look.inspectStrength>.9);
 const burst=weaponPose(weapon,0,0,1);
 assert(burst.pitch>0,'weapon kick must rotate upward');
}
assert(weaponPose('pistol',0,.40,0).magDrop>.15, 'P250 magazine now moves during reload');
assert(weaponPose('m4',0,.4,0).magDrop>.2);
assert(enemyMotion(1,true,0).stride!==0);
assert(enemyMotion(1,false,1).hitLean>0);
console.log('PASS: recoil / inspect / reload curves for all weapons and enemy motion');
