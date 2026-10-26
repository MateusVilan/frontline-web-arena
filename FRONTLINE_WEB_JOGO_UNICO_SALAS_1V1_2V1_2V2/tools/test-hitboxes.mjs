import assert from 'node:assert/strict';
import {traceEnemies,directionFromYawPitch} from '../shared/hitboxes.js';
const e={id:1,x:0,z:0,alive:true};
function at(y,x=0){const origin={x,y,z:3};const target={x,y,z:0};const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;const size=Math.hypot(dx,dy,dz);const d={x:dx/size,y:dy/size,z:dz/size};return traceEnemies(origin,d,[e],20);}
assert.equal(at(1.86)?.zone,'head');
assert.equal(at(1.32)?.zone,'torso');
assert.match(at(.50,-.15)?.zone,/leg/);
assert.equal(at(2.7),null);
assert.equal(traceEnemies({x:0,y:1.86,z:3},{x:0,y:0,z:-1},[e],20,1),null);
assert.equal(directionFromYawPitch(0,0).z,-1);
assert.ok(directionFromYawPitch(0,.2).y>0);
assert.equal(traceEnemies({x:0,y:1.86,z:3},{x:0,y:0,z:-1},[{...e,alive:false}],20),null);
console.log('PASS hitboxes: head torso legs, miss above, occlusion, yaw/pitch direction, dead enemy.');
