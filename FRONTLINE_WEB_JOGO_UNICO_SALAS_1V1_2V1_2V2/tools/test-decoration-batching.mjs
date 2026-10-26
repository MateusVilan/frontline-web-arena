import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {buildWorld} from '../src/world.js';
const noop=()=>{};
const canvasContext={fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,arc:noop,ellipse:noop,bezierCurveTo:noop,stroke:noop,fill:noop,fillText:noop,clearRect:noop,save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,createRadialGradient(){return {addColorStop:noop}}};
globalThis.document={createElement(){return {width:256,height:256,getContext(){return canvasContext}}}};
for(const name of ['industrial','harbor']){
  const scene=new T.Scene(),world=buildWorld(T,scene,name);
  let meshes=0,instances=0;
  scene.traverse(obj=>{
    if(obj.isMesh){meshes++;if(obj.isInstancedMesh)instances+=obj.count;}
  });
  // Before batching: industrial 91 meshes / 1207 instances;
  // harbor 88 meshes / 1151 instances. New build must preserve all instances.
  assert.ok(meshes<=70,`${name}: still ${meshes} scene meshes, decoration not grouped`);
  assert.equal(instances,name==='industrial'?1207:1151,`${name}: prop instances lost`);
  const colliders=world.solids.filter(x=>x.isInstancedMesh);
  assert.ok(colliders.length>=8,`${name}: collision geometry missing`);
  world.dispose();
  assert.equal(scene.children.length,0,`${name}: dispose left objects in the scene`);
  console.log(`PASS ${name} decoration batching: ${meshes} meshes, ${instances} instances`);
}
