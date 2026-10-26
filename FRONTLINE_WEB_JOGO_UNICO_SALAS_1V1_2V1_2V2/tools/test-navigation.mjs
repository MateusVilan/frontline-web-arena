import assert from 'node:assert/strict';
import {SIZE,MAPS,getGrid,blocked,findPath,navigateEnemy} from '../shared/maps.js';
assert.equal(SIZE,37);
for(const [name,cfg] of Object.entries(MAPS)){
 const grid=getGrid(name);let count=0;
 assert.equal(grid.length,SIZE);assert.ok(grid.every(row=>row.length===SIZE));
 for(const [index,pos] of cfg.enemies.entries()){
   assert.equal(blocked(name,pos[0],pos[1],.25),false,`enemy ${name} ${pos} inside wall`);
   const target={x:cfg.spawn[0][0],z:cfg.spawn[0][1]};
   const route=findPath(name,pos[0],pos[1],target.x,target.z);
   assert.ok(route.length>0,`no A* route for ${name} ${pos}`);
   const enemy={id:index+1,x:pos[0],z:pos[1],yaw:0};
   let steps=0;
   while(Math.hypot(target.x-enemy.x,target.z-enemy.z)>1.8&&steps<2700){
     navigateEnemy(name,enemy,target,.05,2.1);steps++;
     assert.equal(blocked(name,enemy.x,enemy.z,.23),false,`enemy crossed collision wall in ${name}`);
   }
   assert.ok(steps<2700,`enemy got stuck in ${name} at ${pos}`);count++;
 }
 console.log(`PASS ${name}: ${SIZE}x${SIZE} cells, ${count} enemies navigate walls, routes and collisions.`);
}
