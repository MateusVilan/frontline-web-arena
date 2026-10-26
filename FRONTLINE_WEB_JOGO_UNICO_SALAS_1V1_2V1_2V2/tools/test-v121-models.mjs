import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import { createWeapon,createEnemy,animateEnemy } from '../src/models.js';
const atlas={};
for(const id of ['m4','ak','pistol','mp9','knife']){
 const vm=createWeapon(T,id,{viewArms:true});
 const world=createWeapon(T,id,{viewArms:false});
 assert(vm.root.children.length>5,id+' viewmodel is missing');
 assert(world.root.children.length>=2,id+' enemy weapon is missing');
 assert(world.root.userData.gripSockets?.right?.isVector3,id+' no grip point');
 assert(world.root.userData.gripSockets?.left?.isVector3,id+' no support grip point');
 const enemy=createEnemy(T,id);enemy.updateMatrixWorld(true);
 const {gripMount,gun,gripPosition,leftHandPosition}=enemy.userData;
 assert(gripMount.children.includes(gun),'gun is not parented to the hand socket');
 const rightGrip=gun.userData.gripSockets.right.clone().applyMatrix4(gun.matrixWorld);
 assert(rightGrip.distanceTo(gripPosition)<0.00001,id+' right grip is not aligned with hand');
 const leftGrip=gun.userData.gripSockets.left.clone().applyMatrix4(gun.matrixWorld);
 assert(leftGrip.distanceTo(leftHandPosition)<0.00001,id+' left grip is not aligned with hand');
 assert(gripPosition.z < -.25,'hand is too close to chest');
 const tip=world.muzzleLocal.clone().applyMatrix4(gun.matrixWorld); // local independent coords
 const bounds=new T.Box3().setFromObject(gun);
 assert(bounds.min.z<-.48,id+' muzzle does not project ahead of torso');
 animateEnemy(enemy,true,.1);
 atlas[id]={grip:gripPosition.toArray().map(x=>+x.toFixed(3)),left:leftHandPosition.toArray().map(x=>+x.toFixed(3)),boundsZ:[+bounds.min.z.toFixed(3),+bounds.max.z.toFixed(3)],parts:vm.root.children.length};
}
console.log('PASS V1.2.1 3D grip mounts, pistol, enemy orientation');
console.log(JSON.stringify(atlas,null,2));
