import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {createWeapon,createViewArmRig} from '../src/models.js';

for(const id of ['m4','ak','mp9','pistol','knife']){
 const camera=new T.PerspectiveCamera(78,16/9,.045,100);
 const gun=createWeapon(T,id,{viewArms:true});
 const rig=createViewArmRig(T,id);
 camera.add(gun.root); camera.add(rig.root);
 assert.equal(rig.arms.length,id==='knife'?1:2,`${id} arm count`);
 // Includes idle, recoil, inspect, reload and wall retreat.
 for(const [x,y,z,pitch,yaw,roll,scale] of [
  [.52,-.56,-1.17,.05,.17,0,.66],
  [.48,-.61,-1.14,.20,.30,.10,.66],
  [.44,-.70,-1.11,-.15,.70,.22,.66],
  [.38,-.73,-1.02,.35,-.10,-.30,.66],
  [.65,-.85,-.52,.20,.10,-.30,.55]
 ]){
  gun.root.position.set(x,y,z);gun.root.rotation.set(pitch,yaw,roll);gun.root.scale.setScalar(id==='pistol'?scale*.94:scale);
  camera.updateMatrixWorld(true);rig.update(camera,gun.root);
  camera.updateMatrixWorld(true);
  for(const arm of rig.arms){
   const wrist=gun.root.localToWorld(gun.root.userData.gripSockets[arm.side<0?'left':'right'].clone());
   const visibleArmStart=arm.forearm.localToWorld(new T.Vector3(0,-.5,0));
   const upperStart=arm.upper.localToWorld(new T.Vector3(0,-.5,0));
   const forearmEnd=arm.forearm.localToWorld(new T.Vector3(0,.5,0));
   assert.ok(visibleArmStart.distanceTo(wrist)<.00001,`${id} glove-to-forearm gap ${visibleArmStart.distanceTo(wrist)}`);
   assert.ok(upperStart.distanceTo(forearmEnd)<.00001,`${id} elbow gap`);
   assert.ok(arm.forearm.scale.y<2 && arm.upper.scale.y<2,`${id} excessive arm length`);
  }
 }
 console.log(`PASS ${id} — ${rig.arms.length} arm(s) follow gloves through 5 poses`);
}
