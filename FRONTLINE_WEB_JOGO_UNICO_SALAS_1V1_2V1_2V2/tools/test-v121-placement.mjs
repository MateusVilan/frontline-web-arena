import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {buildWorld} from '../src/world.js';
const dummy={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},arc(){},bezierCurveTo(){},stroke(){},fill(){},fillText(){},getImageData(){return {data:new Uint8ClampedArray(4)}}};
globalThis.document={createElement(type){assert.equal(type,'canvas');return {width:256,height:256,getContext(){return dummy}};}};
for (const map of ['industrial','harbor']) {
 const scene=new T.Scene(), world=buildWorld(T,scene,map);
 const signs=scene.children.filter(s=>s.userData?.wallMounted);
 assert(signs.length>0);
 for (const sign of signs) {
   const onZ=Math.abs(Math.abs(sign.rotation.y)-Math.PI)<.001;
   const wall=onZ?Math.floor(sign.position.z+.05):Math.floor(sign.position.x+.05);
   const along=onZ?Math.floor(sign.position.x):Math.floor(sign.position.z);
   const isWall=onZ?world.grid[wall]?.[along]:world.grid[along]?.[wall];
   assert.equal(isWall,1,'sign not attached to wall tile');
   const error=onZ?Math.abs(sign.position.z-wall):Math.abs(sign.position.x-wall);
   assert(error<=.06,`Floating sign ${map}: ${error}`);
 }
 const ground=scene.children.find(x=>x.isMesh&&x.geometry?.type==='PlaneGeometry'&&x.rotation.x===-Math.PI/2);
 assert(ground);
 const paint=scene.children.filter(o=>o.isInstancedMesh && o.geometry?.type==='BoxGeometry'&&o.geometry?.parameters?.height<=.012);
 for (const obj of paint){
   const matrix=new T.Matrix4(),v=new T.Vector3();
   for (let i=0;i<obj.count;i++) {
     obj.getMatrixAt(i,matrix);v.setFromMatrixPosition(matrix);
     assert(Math.abs(v.y-ground.position.y)<.06,`${map}: stripe ${v.y} is floating`);
   }
 }
 console.log(`PASS ${map}: ${signs.length} wall signs flush; ${paint.length} painted marking batches at ground`);
 world.dispose();
}
