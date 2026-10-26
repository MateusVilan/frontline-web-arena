import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {createWeapon,createViewArmRig} from '../src/models.js';
import {viewmodelPose} from '../src/viewmodel.js';

// Regression: in V1.4.0 the entire pistol grip was outside the bottom of the
// viewport; only a black slide was rendered. Check relevant model points.
const camera=new T.PerspectiveCamera(78,1280/720,.045,120);
for(const id of ['pistol','m4']){
  const w=createWeapon(T,id,{viewArms:true}), pose=viewmodelPose(id);
  camera.add(w.root);w.root.scale.setScalar(pose.scale);
  w.root.position.set(pose.x,pose.y,pose.z);
  w.root.rotation.set(pose.pitch,pose.yaw,pose.roll);
  camera.updateMatrixWorld(true);
  const point=(x,y,z)=>w.root.localToWorld(new T.Vector3(x,y,z)).project(camera);
  const muzzle=point(...w.muzzleLocal.toArray());
  const grip=point(...w.root.userData.gripSockets.right.toArray());
  assert.ok(Math.abs(muzzle.x)<.55 && muzzle.y>-.6 && muzzle.y<.5,`${id}: barrel no longer in playable view`);
  assert.ok(grip.y>-.92 && grip.y<.38,`${id}: gripping hand is off screen`);
  assert.ok(Math.hypot(muzzle.x-grip.x,muzzle.y-grip.y)>.13,`${id}: only a top-down silhouette is shown`);
  if(id==='pistol'){
    const rig=createViewArmRig(T,id);
    assert.equal(rig.arms.length,2,'pistol must have a second support hand');
  }
  console.log(`PASS ${id}: barrel (${muzzle.x.toFixed(2)}, ${muzzle.y.toFixed(2)}), hand (${grip.x.toFixed(2)}, ${grip.y.toFixed(2)})`);
  camera.remove(w.root);
}
