import assert from 'node:assert/strict';
import {getGrid,MAPS} from '../shared/maps.js';
import {clearance2D,weaponWallPose,weaponReach} from '../src/wallclip.js';
for(const name of Object.keys(MAPS)){
 const grid=getGrid(name);
 for(const [x,z] of [[3.5,3.5],[4.5,3.5]]){
  for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[1,1]]){
   const d=clearance2D(grid,x,z,dx,dz);
   assert(Number.isFinite(d)&&d>0&&d<=2.6);
   for(const type of Object.keys(weaponReach)){
    const p=weaponWallPose(d,type);
    assert(p.avoid>=0&&p.avoid<=1);
    assert.equal(p.hide,false,'held gun must remain visible near obstacles');
    assert(p.retract>=0&&p.retract<=1.05);
   }
  }
 }
}
const grid=Array.from({length:8},()=>Array(8).fill(0));
for(let z=0;z<8;z++)grid[z][5]=1;
const close=clearance2D(grid,3.5,3.5,1,0),far=clearance2D(grid,1.5,3.5,1,0);
assert(close<far);
assert(weaponWallPose(close,'m4').retract>weaponWallPose(far,'m4').retract);
console.log('PASS: wall-proximity works on both maps and no weapon disappears');
