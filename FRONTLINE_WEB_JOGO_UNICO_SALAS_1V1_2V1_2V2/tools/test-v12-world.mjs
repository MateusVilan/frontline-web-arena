import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {buildWorld} from '../src/world.js';
const dummy={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},arc(){},ellipse(){},bezierCurveTo(){},stroke(){},fill(){},fillText(){},getImageData(){return {data:new Uint8ClampedArray(4)}}};
globalThis.document={createElement(type){assert.equal(type,'canvas');return {width:256,height:256,getContext(){return dummy}};}};
for(const map of ['industrial','harbor']){
 const scene=new THREE.Scene();const world=buildWorld(THREE,scene,map);
 assert.equal(world.solids.length,4);
 const signs=[];scene.traverse(o=>{if(o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.material.type==='MeshBasicMaterial')signs.push(o);});
 assert.ok(signs.length>=1);
 const meshes=scene.children.filter(o=>o.isInstancedMesh);
 assert.ok(meshes.length>10);
 assert.ok(scene.children.some(o=>o.type==='Mesh'&&o.geometry.type==='SphereGeometry'));
 const stat={map,solids:world.solids.length,instanced:meshes.length,objects:scene.children.length,signs:signs.length};
 world.dispose();assert.equal(scene.children.length,0);
 console.log('PASS',JSON.stringify(stat));
}
