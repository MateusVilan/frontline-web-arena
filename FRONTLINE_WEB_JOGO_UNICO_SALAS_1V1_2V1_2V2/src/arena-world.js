import { MAPS,getGrid,SIZE } from '../shared/maps.js';
// Small symmetric maps drawn with instancing to keep multiplayer GPU cost low.
export function buildArenaWorld(T,scene,id){
 const blue=id==='azure',grid=getGrid(id),items=[],solids=[],mats=[],geometry=[];
 scene.background=new T.Color(MAPS[id].sky);
 scene.fog=new T.FogExp2(MAPS[id].fog,.006);
 const ambient=new T.HemisphereLight(blue?0xc9e7fb:0xffe8cc,blue?0x435565:0x64504a,1.85);scene.add(ambient);
 const sun=new T.DirectionalLight(blue?0xe5f5ff:0xffd5a0,2.05);sun.position.set(8,25,18);sun.castShadow=false;scene.add(sun);
 const mat=(hex)=>{const m=new T.MeshLambertMaterial({color:hex});mats.push(m);return m;};
 function texture(kind){
   const cv=document.createElement('canvas');cv.width=cv.height=256;const ctx=cv.getContext('2d');
   let seed=(blue?91:27)+(kind==='floor'?30:kind==='crate'?54:0);
   const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
   ctx.fillStyle=kind==='floor'?(blue?'#90aab5':'#c0ac97'):kind==='crate'?(blue?'#2f6a7e':'#7f6555'):(blue?'#477d94':'#a9755c');ctx.fillRect(0,0,256,256);
   if(kind==='floor'){
     ctx.strokeStyle=blue?'#6b8995':'#978678';ctx.lineWidth=3;
     for(let n=0;n<=8;n++){ctx.beginPath();ctx.moveTo(n*32,0);ctx.lineTo(n*32,256);ctx.stroke();ctx.beginPath();ctx.moveTo(0,n*32);ctx.lineTo(256,n*32);ctx.stroke();}
     ctx.fillStyle=blue?'#bddee5':'#e2c29c';for(let i=0;i<230;i++)ctx.fillRect(rnd()*256,rnd()*256,1+rnd()*7,1+rnd()*6);
   }else if(kind==='wall'){
     if(blue){ctx.strokeStyle='#244c64';ctx.lineWidth=5;for(let x=0;x<256;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
       ctx.strokeStyle='#93bbcc';ctx.lineWidth=2;for(let x=8;x<256;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}}
     else{ctx.strokeStyle='#754734';ctx.lineWidth=4;for(let y=0;y<256;y+=51){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
      for(let x=0;x<256;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}}
     ctx.fillStyle=blue?'rgba(26,55,70,.17)':'rgba(49,25,12,.14)';for(let i=0;i<90;i++)ctx.fillRect(rnd()*256,rnd()*256,5+rnd()*27,1+rnd()*13);
   }else{ctx.strokeStyle=blue?'#173e52':'#493c2f';ctx.lineWidth=5;for(let y=12;y<256;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}}
   const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=2;return tex;
 }
 const wallTex=texture('wall'),floorTex=texture('floor'),crateTex=texture('crate');floorTex.repeat.set(5,5);
 const concrete=new T.MeshLambertMaterial({map:wallTex}),highlight=mat(blue?0x9bc9dd:0xdcb994),crate=new T.MeshLambertMaterial({map:crateTex}),cap=mat(blue?0x173747:0x503b30),stripes=mat(blue?0x7ce4e8:0xffbd64),groundMat=new T.MeshLambertMaterial({map:floorTex});
 mats.push(concrete,crate,groundMat);

 const floorGeo=new T.PlaneGeometry(SIZE,SIZE);geometry.push(floorGeo);
 const floor=new T.Mesh(floorGeo,groundMat);floor.rotation.x=-Math.PI/2;floor.position.set(SIZE/2,-.040,SIZE/2);scene.add(floor);items.push(floor);solids.push(floor);
 const basicGeo=new T.BoxGeometry(1,1,1);geometry.push(basicGeo);
 const wall=[],wallsTrim=[],cover=[],coverTop=[],floorMark=[];
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  if(grid[z][x]===1){wall.push([x+.5,1.55,z+.5,1,3.1,1]);wallsTrim.push([x+.5,3.10,z+.5,1.04,.10,1.04]);}
  if(grid[z][x]===2){cover.push([x+.5,.75,z+.5,.94,1.5,.94]);coverTop.push([x+.5,1.51,z+.5,1,.045,1]);}
 }
 for(let i=7;i<=29;i+=4){floorMark.push([i+.5,-.023,18.5,.07,.018,.65]);}
 const batches=[[wall,concrete,true],[wallsTrim,cap,false],[cover,crate,true],[coverTop,highlight,false],[floorMark,stripes,false]];
 const obj=new T.Object3D();
 for(const [positions,material,collide] of batches){if(!positions.length)continue;
  const mesh=new T.InstancedMesh(basicGeo,material,positions.length);
  positions.forEach(([x,y,z,sx,sy,sz],i)=>{obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.rotation.set(0,0,0);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;scene.add(mesh);items.push(mesh);if(collide)solids.push(mesh);
 }
 // Two distinct architectural landmarks, all mounted to the floor or wall.
 const trimGeo=new T.BoxGeometry(1,1,1);geometry.push(trimGeo);
 const markers=[];const eye=mat(blue?0x52d6e8:0xf5aa50),dark=mat(blue?0x1f4358:0x4c3c33);
 function block(x,y,z,w,h,d,material){const mesh=new T.Mesh(trimGeo,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);scene.add(mesh);items.push(mesh);}
 for(const x of [6.15,30.85]){
  block(x,1.25,18.5,.13,2.5,2.3,dark);block(x,2.56,18.5,.23,.13,2.5,eye);
 }
 if(blue){for(const x of [12,25]){block(x,1.0,7,.9,2,.7,dark);block(x,2.05,7,1.1,.1,.9,eye);}}
 else{for(const z of [10,26]){block(18.5,1,z,1.5,2,.55,dark);block(18.5,2.05,z,1.55,.1,.65,eye);}}
 // Arena branding is attached to a genuine wall face and stays out of collision rays.
 const labelCv=document.createElement('canvas');labelCv.width=512;labelCv.height=128;
 const labelCtx=labelCv.getContext('2d');labelCtx.fillStyle=blue?'#12384a':'#4e3328';labelCtx.fillRect(0,0,512,128);
 labelCtx.strokeStyle=blue?'#6ae5f2':'#f4be80';labelCtx.lineWidth=7;labelCtx.strokeRect(9,9,494,110);
 labelCtx.fillStyle='#fff5de';labelCtx.font='bold 50px Arial';labelCtx.textAlign='center';labelCtx.fillText(blue?'TERMINAL // 02':'FERRUGEM // 01',256,77);
 const labelTex=new T.CanvasTexture(labelCv);labelTex.colorSpace=T.SRGBColorSpace;
 const labelMat=new T.MeshBasicMaterial({map:labelTex,side:T.DoubleSide});mats.push(labelMat);
 const labelGeo=new T.PlaneGeometry(3.75,.94);geometry.push(labelGeo);
 const labelMesh=new T.Mesh(labelGeo,labelMat);labelMesh.position.set(18.5,2.12,blue?16.45:17.46);scene.add(labelMesh);items.push(labelMesh);
 // Warm/cool lamps above the side passages, purely decorative and cheap.
 const lampMat=new T.MeshBasicMaterial({color:blue?0x98efff:0xffdd9a});mats.push(lampMat);
 for(const x of [6.05,30.95]){block(x,2.58,11.3,.10,.16,.83,lampMat);block(x,2.58,25.3,.10,.16,.83,lampMat);}
 return {ground:floor,solids,objects:items,dispose(){for(const o of items)scene.remove(o);for(const g of geometry)g.dispose();for(const m of mats)m.dispose();for(const tex of [wallTex,floorTex,crateTex,labelTex])tex.dispose();ambient.parent?.remove(ambient);sun.parent?.remove(sun);}};
}
