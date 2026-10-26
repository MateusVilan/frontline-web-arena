import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {createWeapon,createViewArmRig} from '../src/models.js';
import {VIEWMODEL_POSES,viewmodelPose} from '../src/viewmodel.js';
const camera=new T.PerspectiveCamera(78,1100/720,.045,100);
camera.rotation.order='YXZ';
for(const id of ['m4','ak','mp9','pistol','knife']){
 const c=viewmodelPose(id),view=createWeapon(T,id,{viewArms:true}),arms=createViewArmRig(T,id);
 assert.equal(c,VIEWMODEL_POSES[id]);
 assert.ok(c.scale>.43&&c.scale<.8,'consistent model scale');
 assert.ok(c.yaw>.15&&c.yaw<.8,'show weapon side instead of only top');
 view.root.scale.setScalar(c.scale);view.root.position.set(c.x,c.y,c.z);view.root.rotation.set(c.pitch,c.yaw,c.roll);
 camera.add(view.root);camera.add(arms.root);arms.update(camera,view.root);
 camera.updateMatrixWorld(true);
 const tip=view.root.localToWorld(view.muzzleLocal.clone()).project(camera);
 assert.ok(tip.x>-.6&&tip.x<.7,'muzzle inside horizontal view');
 assert.ok(tip.y>-.65&&tip.y<.5,'muzzle inside lower half of screen');
 for(const a of arms.arms){
  assert.ok(a.forearm.scale.y>.01,'forearm connects wrist to elbow');
  assert.ok(a.upper.scale.y>.01,'upper sleeve connects elbow to body');
 }
 console.log('PASS',id,'muzzle',tip.x.toFixed(2),tip.y.toFixed(2), 'arm segments',arms.arms.length);
 camera.remove(view.root);camera.remove(arms.root);
}
