import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../public/vendor/three.module.js';
import {createWeapon,createEnemy} from '../src/models.js';
import {buildWorld} from '../src/world.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
for(const id of ['health-state','hp-panel','ammo-panel','ammo-track-fill','reload-indicator'])assert(index.includes('id="'+id+'"'),`Missing HUD ${id}`);
for(const id of ['pistol','knife']){
 const w=createWeapon(THREE,id,{viewArms:true});
 w.root.position.set(id==='pistol'?.39:.38,-.61,id==='pistol'?-1.03:-.93);w.root.rotation.y=.1;
 w.root.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(w.root);
 assert(Number.isFinite(b.min.x+b.min.y+b.min.z+b.max.x+b.max.y+b.max.z),`Invalid ${id} geometry`);
 assert(b.max.z<0.35,`Unexpected rear of ${id} model near camera`);
 assert(w.root.userData.gripSockets?.right?.isVector3,`No ${id} grip socket`);
 const enemy=createEnemy(THREE,id);enemy.updateMatrixWorld(true);
 assert(enemy.userData.gun.parent===enemy.userData.gripMount,`${id} is not held by enemy`);
 console.log('PASS',id,'weapon bounds',b.min.toArray().map(x=>x.toFixed(2)),b.max.toArray().map(x=>x.toFixed(2)));
}
assert(script.includes('world.ground'),'Ground references missing from decals');
for(const id of ['m4','ak','pistol','mp9','knife','impact_concrete','impact_wood','impact_metal','reload']){
 const wav=fs.readFileSync(path.join(root,'public/audio',id+'.wav'));
 assert.equal(wav.toString('ascii',0,4),'RIFF',id+' invalid WAV');
 assert.equal(wav.toString('ascii',8,12),'WAVE',id+' invalid WAVE');
 assert(wav.length>4000,id+' too short');
}
// Minimal canvas mock for procedural textures; world geometry is actual Three.js.
const ctx={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},bezierCurveTo(){},fill(){},fillText(){}};
globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>ctx})};
for(const id of ['industrial','harbor']){
 const scene=new THREE.Scene(),world=buildWorld(THREE,scene,id);
 assert(world.solids.includes(world.ground),'Floor is not a raycast target');scene.updateMatrixWorld(true);
 const raycaster=new THREE.Raycaster(new THREE.Vector3(3.5,1.65,3.5),new THREE.Vector3(0,-1,0));
 const hit=raycaster.intersectObject(world.ground)[0];
 assert(hit && hit.point.y<0 && hit.distance>1,'Floor is not hit by a downward shot');
 world.dispose();
 console.log('PASS',id,'floor hit',hit.point.y.toFixed(3));
}
console.log('PASS V1.2.2 audio files, weapon geometry, HUD, surface impact raycasts');
