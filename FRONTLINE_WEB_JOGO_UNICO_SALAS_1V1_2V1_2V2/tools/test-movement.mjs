import assert from 'node:assert/strict';
import {movementVector} from '../src/movement.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`expected ${a} to be near ${b}`);
// Verify W/S and A/D follow the camera forward/right unit vectors at every yaw.
for(const a of [0,.3,Math.PI/2,Math.PI,3*Math.PI/2,-.8,3.7]){
 const f=movementVector(a,1,0,1,1);
 const b=movementVector(a,-1,0,1,1);
 const r=movementVector(a,0,1,1,1);
 const l=movementVector(a,0,-1,1,1);
 close(f.dx,-Math.sin(a)); close(f.dz,-Math.cos(a));
 close(r.dx,Math.cos(a)); close(r.dz,-Math.sin(a));
 close(l.dx,-r.dx);close(l.dz,-r.dz);
 close(b.dx,-f.dx);close(b.dz,-f.dz);
 close(Math.hypot(f.dx,f.dz),1);close(Math.hypot(r.dx,r.dz),1);
 const diag=movementVector(a,1,1,1,1);
 close(Math.hypot(diag.dx,diag.dz),1);
 close(f.dx*r.dx+f.dz*r.dz,0);
}
assert.deepEqual(movementVector(0,0,0,10,.016),{dx:0,dz:0});
assert.deepEqual(movementVector(NaN,1,0,1,1),{dx:0,dz:0});
console.log('PASS: W/A/S/D tested in 7 camera orientations; strafe right and left never invert; diagonal normalized.');
