import assert from 'node:assert/strict';
import fs from 'node:fs';
import {traceEnemies,directionFromYawPitch} from '../shared/hitboxes.js';
import {applyShotDamage} from '../src/combat.js';
import {weaponWallPose,clearance2D} from '../src/wallclip.js';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
assert.match(source,/if\(mode==='solo' && hit\)\{const outcome=applyShotDamage\(hit,w.damage\)/,'all weapon types must resolve damage locally');
assert.doesNotMatch(source,/else if\(hit\)\{const target=hit.enemy;/,'regression: gun hits tied to knife else branch');
assert.doesNotMatch(source,/if\(wallState\.hide\).*visible=false/,'regression: do not hide equipped gun when facing a wall');
for(const weapon of ['m4','ak','pistol','mp9','knife']){
 const target={x:5.5,z:5.5,health:100,alive:true};
 const origin={x:5.5,y:1.65,z:8.5};
 const ray=directionFromYawPitch(0,0);
 const hit=traceEnemies(origin,ray,[target],40,Infinity);
 assert(hit,`${weapon}: forward ray should hit target`);
 const damage={m4:34,ak:43,pistol:38,mp9:23,knife:80}[weapon];
 let strikes=0;
 while(target.alive&&strikes<6){const shot=applyShotDamage(hit,damage);assert(shot);strikes++;}
 assert.equal(target.alive,false,`${weapon}: must eliminate target`);
}
const wall=Array.from({length:9},()=>Array(9).fill(0));for(let z=0;z<9;z++)wall[z][5]=1;
for(const weapon of ['m4','ak','mp9','pistol','knife']){
 for(const dist of [.05,.20,.40,.75,1.4,2.6]){
  const pose=weaponWallPose(dist,weapon);
  assert.equal(pose.hide,false,`${weapon}: never completely hide weapon`);
  assert(pose.retract>=0 && pose.retract<=1.05);
 }
}
assert(clearance2D(wall,4.5,4.5,1,0)<clearance2D(wall,1.5,4.5,1,0));
console.log('PASS: all 5 weapons kill in solo combat; full weapon visibility at walls; proximity sweep.');
