import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {buildWorld} from '../src/world.js';
import {getGrid,SIZE} from '../shared/maps.js';
const noop=()=>{};
const canvasContext={fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,arc:noop,ellipse:noop,bezierCurveTo:noop,stroke:noop,fill:noop,fillText:noop,clearRect:noop,save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,createRadialGradient(){return {addColorStop:noop}}};
globalThis.document={createElement(){return {width:256,height:256,getContext(){return canvasContext}}}};
for(const mapId of ['industrial','harbor']){
 const scene=new T.Scene(),world=buildWorld(T,scene,mapId),grid=getGrid(mapId);
 const solidMeshes=world.solids.filter(o=>o.isInstancedMesh);
 assert.ok(solidMeshes.length>=8,`expected chunked structural meshes, got ${solidMeshes.length}`);
 assert.ok(solidMeshes.some(o=>o.frustumCulled),`no cullable geometry: ${mapId}`);
 const count=solidMeshes.reduce((s,o)=>s+o.count,0);
 const expected=grid.flat().filter(v=>v!==0).length;
 assert.equal(count,expected,`lost or duplicated walls/crates in ${mapId}`);
 // Every sampled occupied cell still has a raycastable collider at waist height.
 const caster=new T.Raycaster(new T.Vector3(),new T.Vector3(0,0,-1),0,3);
 let hits=0,checks=0;
 for(let z=2;z<SIZE-2;z+=3)for(let x=2;x<SIZE-2;x+=3){
  if(!grid[z][x]||grid[z][x-1]!==0)continue;
  checks++;
  caster.ray.origin.set(x-.4,1,x+.5===0?0:z+.5);
  caster.ray.direction.set(1,0,0);caster.far=1.3;
  if(caster.intersectObjects(solidMeshes,false).some(h=>h.distance>0&&h.distance<1.3))hits++;
 }
 assert.ok(checks>0&&hits===checks,`${mapId} collider gaps: ${hits}/${checks}`);
 world.dispose();assert.equal(scene.children.length,0,`resources left attached in ${mapId}`);
 console.log(`PASS ${mapId}: ${solidMeshes.length} structural chunks, ${count} occupied cells, ${hits}/${checks} colliders`);
}
