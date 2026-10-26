// World and deterministic grid navigation shared by the browser and the multiplayer server.
export const SIZE=37;
export const MAPS={
 rust:{id:'rust',name:'ARENA FERRUGEM',description:'Duelos rápidos num pátio industrial ao pôr do sol',pvp:true,sky:0xd1a88d,fog:0xbba69a,floor:0x777066,wall:0x8a5d4b,spawn:[[7.5,13.5],[29.5,23.5],[7.5,23.5],[29.5,13.5]],enemies:[]},
 azure:{id:'azure',name:'TERMINAL AZUL',description:'Duelo tático entre contentores e passagens costeiras',pvp:true,sky:0x759fbc,fog:0x8aa7b4,floor:0x6f9095,wall:0x3d718a,spawn:[[7.5,13.5],[29.5,23.5],[7.5,23.5],[29.5,13.5]],enemies:[]},
 industrial:{id:'industrial',name:'COMPLEXO INDUSTRIAL',description:'Pátio de carga, armazéns e centro logístico',sky:0x829fb5,fog:0xa0aeb5,floor:0x626d70,wall:0x896354,
 spawn:[[3.5,3.5],[4.5,3.5]],enemies:[[29.5,28.5],[30.5,10.5],[17.5,25.5],[7.5,27.5],[26.5,5.5],[31.5,18.5],[13.5,16.5],[20.5,33.5]]},
 harbor:{id:'harbor',name:'CAIS DA MEIA-NOITE',description:'Contentores, docas e ruas do porto',sky:0x142333,fog:0x253b51,floor:0x465b65,wall:0x5d7987,
 spawn:[[3.5,3.5],[4.5,3.5]],enemies:[[30.5,29.5],[18.5,25.5],[29.5,6.5],[9.5,30.5],[24.5,19.5],[14.5,12.5],[31.5,18.5],[10.5,22.5]]}
};
function createGrid(){return Array.from({length:SIZE},(_,z)=>Array.from({length:SIZE},(_,x)=> x===0||z===0||x===SIZE-1||z===SIZE-1?1:0));}
function line(a,x1,z1,x2,z2){if(x1===x2){for(let z=Math.min(z1,z2);z<=Math.max(z1,z2);z++)a[z][x1]=1;}else if(z1===z2){for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)a[z1][x]=1;}}
function door(a,x,z,r=0){for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)if(x+dx>0&&z+dz>0&&x+dx<SIZE-1&&z+dz<SIZE-1)a[z+dz][x+dx]=0;}
const grids={};
{
 const a=createGrid();
 line(a,6,8,30,8); for(const x of [10,11,23,24])door(a,x,8);
 line(a,10,8,10,32); for(const z of [13,14,23,24,29])door(a,10,z);
 line(a,24,8,24,32); for(const z of [12,13,20,21,28,29])door(a,24,z);
 line(a,5,21,32,21); for(const x of [7,8,17,18,29,30])door(a,x,21);
 line(a,10,31,24,31);for(const x of [16,17,21])door(a,x,31);
 line(a,27,12,33,12);door(a,30,12);
 const crates=[[5,5],[8,6],[14,4],[20,5],[28,4],[32,7],[6,11],[15,11],[19,15],[28,15],[33,17],[5,19],[7,26],[14,26],[21,26],[27,26],[31,30],[6,32],[13,34],[19,34],[30,34],[15,17],[20,18],[28,23],[13,29]];
 for(const [x,z] of crates)if(!a[z][x])a[z][x]=2;
 grids.industrial=a;
}
{
 const a=createGrid();
 line(a,8,5,8,31);for(const z of [8,9,17,18,27,28])door(a,8,z);
 line(a,16,3,16,29);for(const z of [6,7,14,15,23,24])door(a,16,z);
 line(a,27,6,27,34);for(const z of [11,12,21,22,30,31])door(a,27,z);
 line(a,8,12,33,12);for(const x of [13,14,22,23,30,31])door(a,x,12);
 line(a,5,25,27,25);for(const x of [7,8,17,18,24,25])door(a,x,25);
 const crates=[[5,7],[12,5],[20,5],[30,5],[4,14],[11,17],[21,18],[31,17],[12,22],[5,30],[14,30],[22,30],[32,29],[30,23],[20,33],[33,34],[23,9],[10,34],[18,10],[32,8]];
 for(const [x,z] of crates)if(!a[z][x])a[z][x]=2;
 grids.harbor=a;
}
// Two symmetrical competitive arenas with guaranteed independent approach lanes.
for(const id of ['rust','azure']){
 const a=createGrid();
 // Bound the arena without needing a second physics engine.
 for(let x=4;x<=32;x++){a[5][x]=1;a[31][x]=1;}
 for(let z=5;z<=31;z++){a[z][4]=1;a[z][32]=1;}
 if(id==='rust'){
  for(let z=9;z<=12;z++){a[z][13]=1;a[z][23]=1;}
  for(let z=24;z<=27;z++){a[z][13]=1;a[z][23]=1;}
  for(let x=15;x<=21;x++)a[18][x]=1;
  for(const [x,z] of [[11,18],[25,18],[16,11],[20,25],[17,23],[19,13],[9,9],[27,27],[12,28],[24,8]])a[z][x]=2;
 }else{
  for(let z=12;z<=24;z++){if(z!==17&&z!==18&&z!==19){a[z][14]=1;a[z][22]=1;}}
  for(const [x,z] of [[11,10],[26,10],[11,26],[26,26],[18,12],[18,24],[8,19],[29,19],[17,17],[20,20],[17,20],[20,17]])a[z][x]=2;
 }
 grids[id]=a;
}
export function getGrid(id='industrial'){return grids[id]||grids.industrial;}
export function tile(id,x,z){const ix=Math.floor(x),iz=Math.floor(z);return ix<0||iz<0||ix>=SIZE||iz>=SIZE?1:getGrid(id)[iz][ix];}
export function blocked(id,x,z,r=.23){for(const dx of [-r,r])for(const dz of [-r,r])if(tile(id,x+dx,z+dz))return true;return false;}
export function lineOfSight(id,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz),count=Math.ceil(d/.14);for(let i=1;i<count;i++){const t=i/count;if(tile(id,ax+dx*t,az+dz*t))return false;}return true;}
export function angleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}

// A* on a small static tile map. Diagonals only pass when both adjacent sides are open.
// Results are 3D-world waypoints, not screen pixels.
export function findPath(mapId,sx,sz,tx,tz){
 const grid=getGrid(mapId),side=SIZE;
 const ix=v=>Math.max(1,Math.min(side-2,Math.floor(v)));
 const ax=ix(sx),az=ix(sz),bx=ix(tx),bz=ix(tz);
 const valid=(x,z)=>x>0&&z>0&&x<side-1&&z<side-1&&grid[z][x]===0;
 if(!valid(ax,az))return [];
 if(!valid(bx,bz))return [];
 const key=(x,z)=>z*side+x,n=side*side;
 const start=key(ax,az),goal=key(bx,bz);if(start===goal)return [{x:tx,z:tz}];
 const gScore=new Float32Array(n);gScore.fill(Infinity);
 const parents=new Int32Array(n);parents.fill(-1);
 const closed=new Uint8Array(n),open=[{x:ax,z:az,k:start,f:0}];gScore[start]=0;
 const heuristic=(x,z)=>Math.hypot(bx-x,bz-z);
 for(let examined=0;open.length&&examined<n;examined++){
   let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
   const node=open.splice(best,1)[0];if(closed[node.k])continue;
   closed[node.k]=1;
   if(node.k===goal){
     const route=[];let curr=goal;
     while(curr!==start&&curr>=0){route.push({x:curr%side+.5,z:Math.floor(curr/side)+.5});curr=parents[curr];}
     route.reverse();
     if(route.length){const last=route[route.length-1];if(Math.hypot(tx-last.x,tz-last.z)<.5)route[route.length-1]={x:tx,z:tz};}
     return route;
   }
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dz)continue;
     const x=node.x+dx,z=node.z+dz;if(!valid(x,z))continue;
     if(dx&&dz&&(!valid(node.x+dx,node.z)||!valid(node.x,node.z+dz)))continue;
     const k=key(x,z);if(closed[k])continue;
     const tentative=gScore[node.k]+(dx&&dz?Math.SQRT2:1);
     if(tentative>=gScore[k])continue;
     parents[k]=node.k;gScore[k]=tentative;
     open.push({x,z,k,f:tentative+heuristic(x,z)});
   }
 }
 return [];
}

// Moves a hostile NPC around cover (shared by solo play and the multiplayer server).
// Only recalculates A* when the target changes cell or the cached route expires.
export function navigateEnemy(mapId,e,target,dt,speed=1.25){
 const distance=Math.hypot(target.x-e.x,target.z-e.z);
 if(distance<1.8){e.walk=false;return false;}
 e.navTimer=(e.navTimer||0)-dt;
 const targetCell=`${Math.floor(target.x)},${Math.floor(target.z)}`;
 if(e.navTimer<=0||e.navTarget!==targetCell||!e.path){
   e.path=findPath(mapId,e.x,e.z,target.x,target.z);
   e.navTarget=targetCell;e.navTimer=.75+((e.id||0)%3)*.13;
 }
 let waypoint=e.path?.[0];
 while(waypoint && Math.hypot(waypoint.x-e.x,waypoint.z-e.z)<.33){e.path.shift();waypoint=e.path[0];}
 if(!waypoint && lineOfSight(mapId,e.x,e.z,target.x,target.z))waypoint=target;
 if(!waypoint){e.walk=false;return false;}
 const dx=waypoint.x-e.x,dz=waypoint.z-e.z,dist=Math.hypot(dx,dz);
 if(dist<.001)return false;
 const step=Math.min(speed*dt,dist),vx=dx/dist*step,vz=dz/dist*step;
 const oldX=e.x,oldZ=e.z;
 if(!blocked(mapId,e.x+vx,e.z+vz,.25)){e.x+=vx;e.z+=vz;}
 else{
   if(!blocked(mapId,e.x+vx,e.z,.25))e.x+=vx;
   if(!blocked(mapId,e.x,e.z+vz,.25))e.z+=vz;
 }
 const moved=Math.hypot(e.x-oldX,e.z-oldZ)>.0001;
 e.walk=moved;
 if(!moved){e.navTimer=0;e.path=[];}
 if(moved)e.yaw+=angleDelta(Math.atan2(-(e.x-oldX),-(e.z-oldZ)),e.yaw)*Math.min(1,dt*6);
 return moved;
}
