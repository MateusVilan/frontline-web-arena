import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {createWeapon,createEnemy,animateEnemy} from '../src/models.js';
const p=createWeapon(T,'pistol',{viewArms:true});
assert(p.magazine,'P250 must include separate reload magazine');
assert(p.root.children.includes(p.magazine));
const t=new T.DataTexture(new Uint8Array([255,220,180,255]),1,1);
t.needsUpdate=true;
for(const id of ['m4','ak','mp9','pistol']){
 const e=createEnemy(T,id,{muzzleTexture:t});
 assert(e.userData.muzzleFlash?.isSprite,`${id} must have muzzle sprite`);
 assert.equal(e.userData.muzzleFlash.visible,false);
 e.userData.firePulse=.11;
 animateEnemy(e,false,.03);
 assert.equal(e.userData.muzzleFlash.visible,true);
 animateEnemy(e,false,.2);
 assert.equal(e.userData.muzzleFlash.visible,false);
}
console.log('PASS V1.3.1: P250 reload magazine and enemy muzzle flashes');
