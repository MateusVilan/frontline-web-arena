/* Mesma geometria determinista no servidor e no browser. */
function makeMap(id, name, width, height, theme, furniture) {
  const cells = Array.from({length:height},(_,z)=>
    Array.from({length:width},(_,x)=>x===0||z===0||x===width-1||z===height-1?'#':'.'));
  function rect(x,z,w,h,char='#') {for(let j=z;j<z+h;j++)for(let i=x;i<x+w;i++){
    if (j>0&&j<height-1&&i>0&&i<width-1) cells[j][i]=char;
  }}
  furniture(rect);
  return {id,name,width,height,theme,grid:cells.map(r=>r.join('')),
    spawns:{A:[[3.5,height/2-1],[3.5,height/2+1]],B:[[width-3.5,height/2-1],[width-3.5,height/2+1]]}};
}
export const MAPS = Object.freeze({
  dockyard:makeMap('dockyard','DOCKYARD',29,21,'dock',r=>{
    r(7,3,2,5);r(7,13,2,5);r(20,3,2,5);r(20,13,2,5);
    r(12,3,5,2);r(12,16,5,2);
    r(13,9,3,3,'c');r(10,7,2,2,'c');r(17,12,2,2,'c');
    r(4,5,2,2,'c');r(23,14,2,2,'c');
    r(10,14,2,1,'c');r(17,6,2,1,'c');
  }),
  foundry:makeMap('foundry','FOUNDRY',29,21,'foundry',r=>{
    r(8,4,2,6);r(8,12,2,5);r(19,4,2,5);r(19,11,2,6);
    r(12,6,5,2);r(12,13,5,2);
    r(13,9,3,3,'c');
    r(4,4,2,2,'c');r(23,4,2,2,'c');r(4,15,2,2,'c');r(23,15,2,2,'c');
    r(11,3,2,1,'c');r(16,17,2,1,'c');r(11,17,2,1,'c');r(16,3,2,1,'c');
  })
});
export const MODES={ '1v1':{max:2,teamA:1,teamB:1},'2v1':{max:3,teamA:2,teamB:1},'2v2':{max:4,teamA:2,teamB:2}};
export const WEAPONS={rifle:{name:'MK18',ammo:30,damage:27,cooldown:0.105,range:27,reload:1.9,draw:.30,speed:4.9},
  pistol:{name:'P250',ammo:13,damage:37,cooldown:0.25,range:27,reload:1.35,draw:.24,speed:5.2},
  knife:{name:'BUTTERFLY',ammo:0,damage:80,cooldown:0.65,range:1.85,reload:0,draw:.22,speed:6.3}};
export function blockAt(map,x,z){return map.grid[Math.floor(z)]?.[Math.floor(x)]||'#'}
export function canStand(map,x,z,r=.28){return [[-r,-r],[r,-r],[-r,r],[r,r]].every(([a,b])=>blockAt(map,x+a,z+b)==='.');}
/** Subpassos impedem atravessar uma parede entre dois pacotes de movimento. */
export function sweepMove(map,x,z,dx,dz,r=.28){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.16));
  for(let i=0;i<steps;i++){
    const mx=dx/steps,mz=dz/steps;
    if(canStand(map,x+mx,z,r))x+=mx;
    if(canStand(map,x,z+mz,r))z+=mz;
  }
  return {x,z};
}
export function moveSpeed(weapon,slow=false,crouch=false){
  return (WEAPONS[weapon]?.speed||WEAPONS.rifle.speed)*(slow?.48:1)*(crouch?.55:1);
}
