import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {createEnemy,createDistantEnemy} from '../src/models.js';
for (const weapon of ['m4','ak','pistol','mp9','knife']) {
 const detailed=createEnemy(T,weapon);
 const simple=createDistantEnemy(T,weapon);
 let full=0,low=0;
 detailed.traverse(n=>{if(n.isMesh)full++});
 simple.traverse(n=>{if(n.isMesh)low++});
 assert(low<=15 && low<full/2,`${weapon}: far enemy should have far fewer meshes (${low} vs ${full})`);
 assert(simple.children.every(o=>o.isMesh));
}
console.log('PASS: distant bots use <=15 meshes; detailed bots retain full 3D models.');
