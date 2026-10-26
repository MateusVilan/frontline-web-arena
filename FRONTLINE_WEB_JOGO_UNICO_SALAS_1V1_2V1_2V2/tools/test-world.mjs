import assert from 'node:assert/strict';
import {buildWorld} from '../src/world.js';

class Material{constructor(opts={}){Object.assign(this,opts)}dispose(){}}
class Geometry{constructor(...args){this.args=args}dispose(){}}
class Object3D{constructor(){this.position={set(...p){this.value=p}};this.rotation={set(){}};this.scale={set(){}};this.matrix={}}updateMatrix(){}}
class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(){}};this.rotation={};} }
class InstancedMesh extends Mesh{constructor(g,m,n){super(g,m);this.count=n;this.transforms=[];this.instanceMatrix={};}setMatrixAt(i,m){this.transforms[i]=m;}}
class Light{constructor(){this.position={set(){}};this.shadow={mapSize:{set(){}},camera:{}}}}
class Texture{constructor(){this.wrapS=0;this.wrapT=0;}dispose(){}}
const T={Color:class{constructor(n){this.n=n}},FogExp2:class{},HemisphereLight:Light,DirectionalLight:Light,PointLight:Light,Mesh,InstancedMesh,BoxGeometry:Geometry,PlaneGeometry:Geometry,MeshStandardMaterial:Material,Object3D,CanvasTexture:Texture,SRGBColorSpace:'srgb',RepeatWrapping:'repeat'};
globalThis.document={createElement(kind){assert.equal(kind,'canvas');return {width:0,height:0,getContext(){return {fillRect(){},strokeRect(){},beginPath(){},moveTo(){},bezierCurveTo(){},stroke(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}}}}}};
for(const map of ['industrial','harbor']){
 const scene={members:[],add(x){this.members.push(x)},remove(x){this.members=this.members.filter(y=>y!==x)}};
 const world=buildWorld(T,scene,map);
 assert.equal(world.solids.length,3,'two instanced wall groups and one crate group');
 assert.ok(world.solids.every(x=>x.count>0));
 const instanced=scene.members.filter(x=>x instanceof InstancedMesh);
 assert.ok(instanced.length<=20,`too many 3D batches: ${instanced.length}`);
 assert.ok(instanced.some(x=>x.count>=30),'walls instanced instead of a drawcall for each');
 world.dispose();
 assert.ok(!scene.members.some(x=>x instanceof InstancedMesh),'instanced meshes removed during map switch');
 console.log(`PASS: ${map} map uses ${instanced.length} instanced batches, 3 raycast groups; map resources cleaned.`);
}
