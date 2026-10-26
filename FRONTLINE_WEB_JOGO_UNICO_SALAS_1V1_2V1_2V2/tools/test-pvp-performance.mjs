import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {createArenaFighter,setArenaFighterWeapon} from '../src/models.js';
import {simulationDelta,simulationSteps} from '../src/timestep.js';
for(const id of ['m4','ak','mp9','pistol','knife']){
 for(const team of ['blue','orange']){
  const fighter=createArenaFighter(T,team,id);
  const meshes=[];fighter.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.ok(meshes.length<=5,`${team}/${id} should use <=5 draw calls, got ${meshes.length}`);
  assert.equal(fighter.userData.weaponId,id);
  assert.ok(fighter.userData.rifle.parent===fighter);
  assert.ok(setArenaFighterWeapon(fighter,id==='m4'?'knife':'m4'));
  assert.ok(fighter.userData.parts.length<=4);
  for(const mesh of meshes)mesh.geometry.dispose();
  for(const mesh of meshes)mesh.material.dispose();
  console.log('PASS',team,id,'meshes:',meshes.length);
 }
}
for(const fps of [13,20,30,60,144]){
 const ms=1000/fps;
 const steps=simulationSteps(ms);
 const total=steps.reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(total-simulationDelta(ms))<1e-6);
 assert.ok(steps.every(d=>d<=.04000001));
 const advanced=Array.from({length:fps},()=>simulationDelta(ms)).reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(advanced-1)<.01,`movement should advance one second at ${fps}FPS`);
 console.log('PASS',fps,'FPS ->',steps.length,'physics step(s)');
}
assert.equal(simulationDelta(5000),.12,'tab suspension cap');
assert.equal(simulationDelta(NaN),0);
