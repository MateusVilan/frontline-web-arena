import {MAPS,getGrid,SIZE} from '../shared/maps.js';
import {buildArenaWorld} from './arena-world.js';
// Efficient 3D environments: most geometry is grouped in InstancedMesh batches.
export function buildWorld(T,scene,mapId){
 if(MAPS[mapId]?.pvp)return buildArenaWorld(T,scene,mapId);
 const harbor=mapId==='harbor',cfg=MAPS[mapId],grid=getGrid(mapId),solids=[],objects=[],resources=[];
 scene.background=new T.Color(cfg.sky);
 scene.fog=new T.FogExp2(cfg.fog,harbor?.0085:.0055);
 // A lightweight sky gradient removes the flat backdrop without costing much GPU time.
 const skyDome=new T.Mesh(new T.SphereGeometry(92,18,12),new T.ShaderMaterial({
  side:T.BackSide,depthWrite:false,fog:false,
  uniforms:{topColor:{value:new T.Color(harbor?0x173b56:0x537f9f)},horizonColor:{value:new T.Color(harbor?0x7596a9:0xd4d8d2)}},
  vertexShader:'varying vec3 vSky; void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec3 vSky; uniform vec3 topColor;uniform vec3 horizonColor;void main(){float h=clamp(vSky.y/92.0*2.0+0.35,0.0,1.0);h=h*h*(3.0-2.0*h);gl_FragColor=vec4(mix(horizonColor,topColor,h),1.0);}'
 }));skyDome.position.set(SIZE*.5,0,SIZE*.5);skyDome.renderOrder=-10;scene.add(skyDome);

 const ambient=new T.HemisphereLight(harbor?0xb7d7f3:0xecf3ff,harbor?0x263848:0x62645c,harbor?1.72:1.62);scene.add(ambient);
 const sun=new T.DirectionalLight(harbor?0xc4d8f0:0xffe4bf,harbor?1.52:1.94);sun.position.set(12,22,9);sun.castShadow=true;sun.shadow.mapSize.set(384,384);sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;sun.shadow.camera.near=.5;sun.shadow.camera.far=95;sun.shadow.bias=-.001;scene.add(sun);
 const material=(color,roughness=.85,metalness=0)=>metalness>.25?new T.MeshStandardMaterial({color,roughness,metalness}):new T.MeshLambertMaterial({color});
 const mats=[];
 function mat(c,r=.9,m=0){const v=material(c,r,m);mats.push(v);return v;}
 function texture(kind){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');let seed=kind==='wood'?113:kind==='brick'?83:141;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
   const base=kind==='floor'?(harbor?'#a2b0b1':'#b6b4af'):kind==='wood'?'#916741':kind==='brick'?(harbor?'#687988':'#9a7462'):'#858a88';g.fillStyle=base;g.fillRect(0,0,256,256);
   if(kind==='floor'){
     // Repeated floor texture with actual surface details at human scale:
     // harbour: weathered paving stones; industrial: poured concrete sections.
     const rows=harbor?7:4,cols=harbor?7:4,tw=256/cols,th=256/rows;
     g.lineWidth=harbor?1.4:1.9;
     for(let row=0;row<rows;row++)for(let col=-1;col<=cols;col++){
       const x=col*tw+(harbor&&(row%2)?tw*.5:0),y=row*th;
       g.fillStyle=`rgba(239,233,217,${rand()*.035})`;
       g.fillRect(x+1,y+1,tw-2,th-2);
       g.strokeStyle=harbor?'rgba(36,49,52,.19)':'rgba(52,47,43,.16)';
       g.strokeRect(x,y,tw,th);
       if(rand()<.30){g.strokeStyle='rgba(61,57,54,.095)';g.beginPath();g.moveTo(x+tw*.22,y+th*.22);g.lineTo(x+tw*.55,y+th*.45);g.lineTo(x+tw*.58,y+th*.69);g.stroke();}
     }
     for(let i=0;i<85;i++){
       const x=rand()*256,y=rand()*256;
       g.fillStyle=`rgba(${harbor?'27,42,49':'67,58,50'},${.025+rand()*.09})`;
       g.beginPath();g.ellipse(x,y,2+rand()*9,1+rand()*4,rand()*3,0,Math.PI*2);g.fill();
     }
   }
   else if(kind==='brick'){
     if(harbor){
       // Weathered blue container/warehouse cladding with vertical joints.
       for(let col=0;col<8;col++){
         const x=col*32;
         g.fillStyle='rgba(197,218,223,.035)';g.fillRect(x+2,1,29,253);
         g.strokeStyle='rgba(14,35,49,.42)';g.lineWidth=2;
         g.beginPath();g.moveTo(x,0);g.lineTo(x,256);g.stroke();
       }
       for(let i=0;i<25;i++){
         const x=rand()*256,y=rand()*256;
         g.fillStyle=`rgba(161,117,84,${.024+rand()*.09})`;
         g.fillRect(x,y,3+rand()*24,1+rand()*12);
       }
       for(const y of [19,244]){g.strokeStyle='rgba(18,44,55,.24)';g.lineWidth=3;g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();}
     }else{
       // Industrial stucco panels: large joins and faint surface abrasion.
       for(let row=0;row<4;row++)for(let col=0;col<3;col++){
         const x=col*86+(row%2)*15,y=row*64;
         g.fillStyle='rgba(220,199,171,.05)';g.fillRect(x+3,y+3,82,59);
         g.strokeStyle='rgba(48,42,34,.26)';g.lineWidth=2;
         g.strokeRect(x,y,86,64);
       }
       for(let i=0;i<70;i++){
         g.fillStyle=`rgba(40,42,41,${.015+rand()*.045})`;
         g.fillRect(rand()*256,rand()*256,4+rand()*40,1+rand()*8);
       }
     }
   }
   else if(kind==='wood'){for(let i=0;i<44;i++){g.strokeStyle=`rgba(18,12,8,${.06+rand()*.18})`;g.lineWidth=1+rand()*2;const y=rand()*256;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(60,y+rand()*8,180,y-rand()*8,256,y);g.stroke();}}
   else {for(let i=0;i<24;i++){const x=rand()*256,y=rand()*256;g.fillStyle=`rgba(26,28,30,${rand()*.07})`;g.fillRect(x,y,38*rand(),10*rand());}}
   for(let i=0;i<240;i++){let v=Math.round(rand()*205);g.fillStyle=`rgba(${v},${v},${v},${.015+rand()*.075})`;g.fillRect(rand()*256,rand()*256,1+rand()*3,1+rand()*3);}
   const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=2;resources.push(tex);return tex;
 }
 const brickTex=texture('brick'),concreteTex=texture('concrete'),woodTex=texture('wood'),floorTex=texture('floor');floorTex.repeat.set(9,9);
 const wallMat=new T.MeshLambertMaterial({map:brickTex}),concreteMat=new T.MeshLambertMaterial({map:concreteTex}),crateMat=new T.MeshLambertMaterial({map:woodTex});mats.push(wallMat,concreteMat,crateMat);
 const metal=mat(harbor?0x405562:0x414c50,.55,.32),trimMat=mat(harbor?0x1e3944:0x3d3934),yellow=mat(0xd3a34a,.69,.1),orange=mat(0xbc6b3d,.72,.12),dark=mat(0x20343c,.76,.08),glass=mat(0x85becd,.2,.27),kickPlate=mat(harbor?0x415a67:0x46484a,.83,.2);
 // Map-specific facades: naval-blue loading doors at the port, amber workshop doors at the factory.
 const bayDoorMat=mat(harbor?0x285b70:0x826a48,.75,.18),baySeamMat=mat(harbor?0x77a3ad:0xd8b36e,.61,.30);
 const ground=new T.Mesh(new T.PlaneGeometry(SIZE,SIZE),new T.MeshLambertMaterial({color:harbor?0xbac7c8:0xd4cebf,map:floorTex}));ground.rotation.x=-Math.PI/2;ground.position.set(SIZE*.5,-.035,SIZE*.5);ground.receiveShadow=true;scene.add(ground);objects.push(ground);solids.push(ground);
 const batches={brick:[],concrete:[],crate:[],woodStrap:[],cap:[],column:[],vent:[],trim:[],metal:[],yellow:[],orange:[],lane:[],lamp:[],glass:[],pipes:[],roof:[],support:[],banner:[],wallBaseZ:[],wallBaseX:[],wallTopZ:[],wallTopX:[],stanchion:[],stripe:[],crateLid:[],crateBand:[],wallSafety:[],serviceDoor:[],doorLip:[],doorHeader:[],drain:[],plate:[],curbMark:[],roofStack:[],roofStackCap:[],roofAirBox:[]};
 for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
   const kind=grid[z][x];if(!kind)continue;const px=x+.5,pz=z+.5;
   if(kind===1){batches[(x*3+z*5)%7===0?'concrete':'brick'].push([px,1.5,pz]);
     if((x+z)%2===0)batches.cap.push([px,2.95,pz]);
     if((x+z)%7===0)batches.column.push([px,1.51,pz]);
     if((x+z)%8===0)batches.vent.push([px,1.8,pz+.502]);
     // Grounded architectural details: mount metal skirting and coping only
     // where a wall is exposed to a walkable tile.
     if(z>0 && grid[z-1][x]===0){batches.wallBaseZ.push([px,.18,pz-.505]);batches.wallTopZ.push([px,2.96,pz-.505]);if((x+z)%7===0)batches.wallSafety.push([px,.21,pz-.525]);
       if((x*7+z*11)%23===0){batches.serviceDoor.push([px,1.12,pz-.520]);batches.doorLip.push([px,1.12,pz-.539]);batches.doorHeader.push([px,2.23,pz-.536]);}}
     if(x>0 && grid[z][x-1]===0){batches.wallBaseX.push([px-.505,.18,pz]);batches.wallTopX.push([px-.505,2.96,pz]);}
   }else{batches.crate.push([px,.70,pz]);
     batches.woodStrap.push([px,.32,pz+.477],[px,1.05,pz+.477]);
     batches.trim.push([px,.7,pz+.474]);
     // Grounded lid and reinforced crate face; no floating geometry.
     batches.crateLid.push([px,1.389,pz]);batches.crateBand.push([px,.72,pz+.48]);
   }
 }
 const temp=new T.Object3D();
 // V1.5.2: combine static decoration that shares a material into one GPU draw call.
 // Geometry remains instanced (no visual compromises); collisions stay in the
 // original individually chunked meshes, so raycasts/wall sliding are unchanged.
 const decorByMaterial=new Map();
 function addDecoration(material, x,y,z, sx,sy,sz, rotation=0){
   let batch=decorByMaterial.get(material.uuid);
   if(!batch){batch={material,matrices:[]};decorByMaterial.set(material.uuid,batch);}
   temp.position.set(x,y,z);temp.rotation.set(0,rotation,0);
   temp.scale.set(sx,sy,sz);temp.updateMatrix();
   batch.matrices.push(temp.matrix.clone());
 }
 function flushDecoration(){
   if(!decorByMaterial.size)return;
   const cube=new T.BoxGeometry(1,1,1);
   for(const {material,matrices} of decorByMaterial.values()){
     const mesh=new T.InstancedMesh(cube,material,matrices.length);
     for(let i=0;i<matrices.length;i++)mesh.setMatrixAt(i,matrices[i]);
     mesh.instanceMatrix.needsUpdate=true;
     // Global decoration batches are small; avoid extra bounding computations.
     mesh.frustumCulled=false;
     scene.add(mesh);objects.push(mesh);
   }
   decorByMaterial.clear();
 }
 // Divide structural meshes into spatial chunks. Before, every wall/box in the
 // entire 37x37 arena was submitted even when looking into a short corridor.
 // Chunks allow frustum culling and per-chunk raycast rejection at low draw-call cost.
 const chunkSize=12;
 function instanced(name,scale,m,solid=false,shadow=false){
  const pts=batches[name];if(!pts?.length)return;
  if(!solid){
    for(let i=0;i<pts.length;i++){
      const [x,y,z]=pts[i];
      const rotation=name==='stripe'?Math.PI/4:name==='plate'?Math.PI/2*(i%2):name==='drain'?Math.PI/2*((i+1)%2):0;
      addDecoration(m,x,y,z,...scale,rotation);
    }
    return;
  }
  const groups=new Map(),chunked=(name==='brick'||name==='concrete'||name==='crate');
  for(const point of pts){
   const key=chunked?`${Math.floor(point[0]/chunkSize)},${Math.floor(point[2]/chunkSize)}`:'all';
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(point);
  }
  const geo=new T.BoxGeometry(...scale);
  for(const group of groups.values()){
   const mesh=new T.InstancedMesh(geo,m,group.length);
   group.forEach((point,i)=>{
    temp.position.set(...point);
    temp.rotation.set(0,name==='stripe'?Math.PI/4:name==='plate'?Math.PI/2*(i%2):name==='drain'?Math.PI/2*((i+1)%2):0,0);
    temp.scale.set(1,1,1);temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;
   mesh.frustumCulled=chunked;
   if(chunked && typeof mesh.computeBoundingSphere==='function')mesh.computeBoundingSphere();
   mesh.castShadow=shadow;mesh.receiveShadow=shadow;
   scene.add(mesh);objects.push(mesh);if(solid)solids.push(mesh);
  }
 }

 // Structural meshes remain raycast targets. Decoration is batched separately.
 instanced('brick',[1,3,1],wallMat,true,true);instanced('concrete',[1,3,1],concreteMat,true,true);
 instanced('crate',[.93,1.4,.93],crateMat,true,true);
 instanced('cap',[1.04,.075,1.04],metal);instanced('column',[.15,3.06,.15],trimMat);
 instanced('woodStrap',[.94,.073,.055],trimMat);instanced('trim',[.07,.88,.07],trimMat);
 instanced('crateLid',[.96,.035,.96],crateMat);instanced('crateBand',[.96,.055,.022],metal);
 instanced('vent',[.33,.22,.045],dark);
 instanced('wallBaseZ',[1.01,.28,.035],kickPlate);instanced('wallBaseX',[.035,.28,1.01],kickPlate);
 instanced('wallTopZ',[1.03,.08,.095],metal);instanced('wallTopX',[.095,.08,1.03],metal);
 instanced('wallSafety',[.72,.12,.018],yellow);
 instanced('serviceDoor',[.79,2.18,.026],metal);
 instanced('doorLip',[.60,1.94,.010],dark);
 instanced('doorHeader',[.80,.12,.032],yellow);
 // Repeated environment modules use only two instanced draw calls, not hundreds of props.
 // A face can be generated only when the neighboring floor cell is open.
 const bayDoors=[];
 for(let z=3;z<SIZE-3;z++)for(let x=3;x<SIZE-3;x++){
   if(grid[z][x]!==1 || ((x*13+z*19)%(harbor?17:21))!==0)continue;
   const north=grid[z-1][x]===0,west=grid[z][x-1]===0;
   if(north)bayDoors.push([x+.5,1.47,z-.514,0]);
   else if(west)bayDoors.push([x-.514,1.47,z+.5,-Math.PI/2]);
 }
 function facingBatch(items,size,material,yOffset=0,zOffset=0){
   if(!items.length)return;
   for(const [x,y,z,rot] of items){
     addDecoration(material,x+Math.sin(rot)*zOffset,y+yOffset,z+Math.cos(rot)*zOffset,...size,rot);
   }
 }
 facingBatch(bayDoors,[.72,2.16,.035],bayDoorMat);
 // The narrow strip sits on the door face. Its width and direction rotate with the wall.
 facingBatch(bayDoors,[.67,.072,.041],baySeamMat,-.67,-.006);
 facingBatch(bayDoors,[.67,.045,.041],baySeamMat,.68,-.006);
 // Short safety edging stays close to the floor and doesn't act as a new collision target.
 facingBatch(bayDoors,[.78,.10,.05],harbor?metal:yellow,-1.04,-.007);
 // Diverse facades without new collision geometry. Each face is firmly mounted
 // to an actual wall and batched (one draw per finish). Alternating sizes and
 // distinct colors make the harbor feel like a dock and the factory like a workshop.
 const wallsBlue=[],wallsAccent=[],windowShutters=[],windowFrames=[],doorBars=[],wallRails=[],utilityLights=[],utilityTrim=[];
 for(let z=3;z<SIZE-3;z++)for(let x=3;x<SIZE-3;x++){
   if(grid[z][x]!==1)continue;
   const nx=grid[z-1][x]===0, wx=grid[z][x-1]===0;
   if(!nx&&!wx)continue;
   if((x*17+z*13)%7!==0)continue;
   const px=nx?x+.5:x-.514, pz=nx?z-.514:z+.5, rot=nx?0:Math.PI/2;
   if((x+z)%3===0)wallsBlue.push([px,1.51,pz,rot]);
   else wallsAccent.push([px,1.51,pz,rot]);
   if((x*5+z*7)%4===0){
      windowShutters.push([px,1.76,pz,rot]);
      windowFrames.push([px,1.76,pz,rot]);
   }
   if((x*3+z*11)%5===0)doorBars.push([px,.83,pz,rot]);
   if((x*7+z*3)%4===0)wallRails.push([px,2.38,pz,rot]);
   if((x*11+z*7)%9===0){utilityLights.push([px,2.44,pz,rot]);utilityTrim.push([px,2.43,pz,rot]);}
 }
 const facadeA=mat(harbor?0x426476:0x7e6553,.90,.03);
 const facadeB=mat(harbor?0x5d7180:0x716d5c,.90,.03);
 const windowDark=mat(harbor?0x162d40:0x242d2f,.65,.12);
 const windowEdge=mat(harbor?0x9baeb6:0xbcae95,.66,.24);
 facingBatch(wallsBlue,[.91,2.60,.036],facadeA,0,-.020);
 facingBatch(wallsAccent,[.91,2.60,.038],facadeB,0,-.021);
 facingBatch(windowShutters,[.51,.60,.046],windowDark,0,-.065);
 facingBatch(windowFrames,[.57,.048,.060],windowEdge,.30,-.083);
 facingBatch(windowFrames,[.57,.048,.060],windowEdge,-.30,-.083);
 facingBatch(doorBars,[.66,.067,.057],harbor?windowEdge:yellow,0,-.079);
 // Facade accent rails and practical lightboxes use shared instanced geometry.
 // Keep them flush with the exposed wall face; no floating signs or moving props.
 facingBatch(wallRails,[.76,.045,.047],harbor?windowEdge:metal,0,-.071);
 const lampHousing=mat(harbor?0x193440:0x343a3b,.56,.34);
 const lampGlow=mat(harbor?0xb6cfce:0xe7c78a,.51,.18);
 facingBatch(utilityTrim,[.20,.17,.050],lampHousing,0,-.079);
 facingBatch(utilityLights,[.11,.055,.061],lampGlow,-.013,-.115);
 // A different family of floor paint emphasizes each map's identity.
 const deckLines=[];
 for(let z=4;z<SIZE-4;z+=5)for(let x=4;x<SIZE-4;x+=7){
   if(grid[z][x]!==0)continue;
   if(harbor)deckLines.push([x+.5,-.026,z+.5]);
   else if((x+z)%2===0)deckLines.push([x+.5,-.026,z+.5]);
 }
 batches[harbor?'harborDeck':'factorySafety']=deckLines;
 instanced(harbor?'harborDeck':'factorySafety',harbor?[.12,.009,.95]:[.80,.009,.085],harbor?baySeamMat:yellow);
 // Painted safety markings, service lanes and container door facades.
 for(let z=3;z<SIZE-3;z+=4){if(grid[z][3]===0)batches.lane.push([3.18,-.027,z+.5]);}
 for(let x=5;x<SIZE-4;x+=6){if(grid[3][x]===0)batches.yellow.push([x+.5,-.027,3.1]);}
 for(let z=4;z<SIZE-4;z+=7)for(let x=4;x<SIZE-4;x+=9){if(!grid[z][x])batches.orange.push([x+.5,-.028,z+.5]);}
 for(let z=5;z<SIZE-5;z++)for(let x=5;x<SIZE-5;x++){
  if(grid[z][x]!==0)continue;
  if((x*13+z*7)%53===0)batches.drain.push([x+.5,-.023,z+.5]);
  if((x*5+z*9)%61===0)batches.plate.push([x+.5,-.022,z+.5]);
  if((x*3+z*11)%47===0)batches.curbMark.push([x+.5,-.026,z+.5]);
 }
 instanced('lane',[.09,.008,1.3],yellow);instanced('yellow',[1.45,.008,.065],yellow);instanced('orange',[.75,.006,.045],orange);
 instanced('drain',[.34,.010,.34],dark);instanced('plate',[.48,.012,.28],metal);instanced('curbMark',[.52,.008,.030],yellow);
 // Roof equipment creates a varied skyline while remaining physically seated
 // on top of real wall blocks (wall roofs end at y=3). No floating props.
 let rooftopCount=0;
 for(let z=4;z<SIZE-4;z++)for(let x=4;x<SIZE-4;x++){
   if(grid[z][x]!==1 || (x*7+z*17)%53!==0 || rooftopCount>=10)continue;
   if(grid[z-1][x]!==0&&grid[z+1][x]!==0&&grid[z][x-1]!==0&&grid[z][x+1]!==0)continue;
   const px=x+.5,pz=z+.5;rooftopCount++;
   if((x+z)%2===0){
     batches.roofStack.push([px,harbor?3.32:3.48,pz]);
     batches.roofStackCap.push([px,harbor?3.65:3.98,pz]);
   }else batches.roofAirBox.push([px,3.18,pz]);
 }
 instanced('roofStack',harbor?[.24,.64,.24]:[.20,.96,.20],harbor?metal:dark);
 instanced('roofStackCap',[.37,.09,.37],harbor?windowEdge:metal);
 instanced('roofAirBox',[.62,.34,.56],harbor?windowEdge:trimMat);
 // Pick only walkable locations for streetlamps. Previous fixed coordinates could
 // place a mast inside a wall and leave its lamp head floating above the roof.
 const lampCells=[];
 for(const [x,z] of [[10,8],[14,7],[21,17],[30,31],[8,25],[25,8]]){
   const candidates=[[x,z],[x+1,z],[x-1,z],[x,z+1],[x,z-1]];
   const valid=candidates.find(([cx,cz])=> cx>1 && cz>1 && cx<SIZE-2 && cz<SIZE-2 && grid[cz][cx]===0 && MAPS[mapId].spawn.every(([sx,sz])=>Math.hypot(cx+.5-sx,cz+.5-sz)>6));
   if(valid && !lampCells.some(([ax,az])=>ax===valid[0]&&az===valid[1]))lampCells.push(valid);
 }
 for(const [x,z] of lampCells){
   batches.pipes.push([x+.5,1.19,z+.5]);
   batches.lamp.push([x+.5,2.42,z+.5]);
 }
 instanced('pipes',[.09,2.38,.09],metal);instanced('lamp',[.38,.12,.33],yellow);
 // Lamps keep their warm painted material; no extra per-pixel point-light pass across the arena.

 if(harbor){const sea=new T.Mesh(new T.PlaneGeometry(5.4,5.4),new T.MeshStandardMaterial({color:0x2f667f,metalness:.23,roughness:.33,transparent:true,opacity:.75}));sea.rotation.x=-Math.PI/2;sea.position.set(SIZE-5,.005,2.7);scene.add(sea);objects.push(sea);}
 // Small procedural wall panels (not hovering billboards): selected at walls
 // adjacent to walkable cells, and attached to the actual wall face.
 function signTexture(message,n){
  const c=document.createElement('canvas');c.width=512;c.height=172;
  const g=c.getContext('2d');g.fillStyle=harbor?'#1d3440':'#222b30';g.fillRect(0,0,512,172);
  g.fillStyle='#d5ac5e';g.fillRect(0,0,16,172);g.fillRect(24,18,463,3);g.fillRect(24,151,463,3);
  g.fillStyle='#ebeff0';g.font='900 56px Inter, Arial, sans-serif';g.fillText(message,44,78);
  g.fillStyle='#d6af6d';g.font='700 24px Inter, Arial, sans-serif';g.fillText(harbor?'ÁREA PORTUÁRIA':'ACESSO AUTORIZADO',46,118);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;resources.push(tex);return tex;
 }
 const labels=harbor?['DOCA 03','CAIS NORTE','CONTENTORES','ARMAZÉM 12']:['SETOR 04','CARGA E DESCARGA','BLOCO 07','ÁREA DE SERVIÇO'];
 const signs=[];
 for(let z=3;z<SIZE-3;z++)for(let x=3;x<SIZE-3;x++){
  if(grid[z][x]!==1 || (x*11+z*17)%27!==0)continue;
  if(grid[z-1][x]===0)signs.push([x+.5,2.19,z-.02,Math.PI,new T.Vector3(0,0,-1)]);
  else if(grid[z][x-1]===0)signs.push([x-.02,2.19,z+.5,-Math.PI/2,new T.Vector3(-1,0,0)]);
  if(signs.length>=8)break;
 }
 const signGeo=new T.PlaneGeometry(1.05,.36);
 for(let i=0;i<Math.min(signs.length,6);i++){
  const [sx,sy,sz,rot,normal]=signs[i];
  const tex=signTexture(labels[i%labels.length],i);
  const signGroup=new T.Group();
  signGroup.position.set(sx,sy,sz);
  signGroup.position.addScaledVector(normal,.017);
  signGroup.rotation.y=rot;
  const front=new T.Mesh(signGeo,new T.MeshBasicMaterial({map:tex,side:T.FrontSide}));
  front.position.z=.004;
  signGroup.add(front);
  scene.add(signGroup);objects.push(signGroup);
  const frame=new T.Mesh(new T.BoxGeometry(1.11,.42,.03),metal);
  frame.rotation.y=rot;frame.position.copy(signGroup.position).addScaledVector(normal.clone().negate(),.017);
  scene.add(frame);objects.push(frame);
  signGroup.userData.wallMounted=true;
 }
 // Painted striped corner warnings sit on the ground, not in the sky.
 const striped=new T.MeshBasicMaterial({color:harbor?0xe2a345:0xd1a157});mats.push(striped);
 let stripeCount=0;
 for(let z=4;z<SIZE-4;z+=6)for(let x=4;x<SIZE-4;x+=7){
  if(grid[z][x]!==0 || stripeCount++>23)continue;
  for(let i=0;i<3;i++)batches.stripe.push([x+.15+i*.22,-.026,z+.2]);
 }
 instanced('stripe',[.10,.012,.52],striped);
 flushDecoration();
 return {cfg,grid,solids,ground,dispose(){
  // Dispose children of grouped signs, too: the old implementation only disposed
  // the group's root (which has no geometry), leaking GPU textures/materials when
  // changing map several times in multiplayer.
  const geometries=new Set(),materials=new Set();
  for(const o of objects){
    o.traverse?.(child=>{
      if(child.geometry)geometries.add(child.geometry);
      if(Array.isArray(child.material))child.material.forEach(m=>m&&materials.add(m));
      else if(child.material)materials.add(child.material);
    });
    scene.remove(o);
    if(o.isInstancedMesh)o.dispose?.();
  }
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
  for(const t of resources)t.dispose();
  for(const m of mats)if(!materials.has(m))m.dispose();
  scene.remove(ambient);scene.remove(sun);scene.remove(skyDome);
  skyDome.geometry.dispose();skyDome.material.dispose();
 }};
}
