// Deterministic 3D hitzones, reused by solo play and the multiplayer server.
// x/z are horizontal world coordinates; y is eye/head height.
const ZONES=[
 {name:'head',cx:0,cy:1.86,cz:-.015,rx:.245,ry:.24,rz:.225,mult:2.2},
 {name:'torso',cx:0,cy:1.31,cz:0,rx:.37,ry:.39,rz:.285,mult:1},
 {name:'left_arm',cx:-.36,cy:1.27,cz:-.28,rx:.145,ry:.27,rz:.21,mult:.82},
 {name:'right_arm',cx:.36,cy:1.27,cz:-.28,rx:.145,ry:.27,rz:.21,mult:.82},
 {name:'left_leg',cx:-.15,cy:.48,cz:0,rx:.145,ry:.43,rz:.195,mult:.75},
 {name:'right_leg',cx:.15,cy:.48,cz:0,rx:.145,ry:.43,rz:.195,mult:.75}
];
export const HIT_ZONES=ZONES;
// Positive ray/ellipsoid distance in world units; works with all forward angles.
export function rayEllipsoid(origin,direction,center,radii){
 const ox=(origin.x-center.x)/radii.x, oy=(origin.y-center.y)/radii.y, oz=(origin.z-center.z)/radii.z;
 const dx=direction.x/radii.x, dy=direction.y/radii.y, dz=direction.z/radii.z;
 const a=dx*dx+dy*dy+dz*dz, bb=ox*dx+oy*dy+oz*dz, c=ox*ox+oy*oy+oz*oz-1;
 const disc=bb*bb-a*c;
 if(disc<0)return null;
 const s=Math.sqrt(disc),near=(-bb-s)/a,far=(-bb+s)/a;
 return near>=0?near:far>=0?far:null;
}
export function traceEnemies(origin,direction,enemies,maxDist=40,wallDistance=Infinity){
 let best=null,nearest=Math.min(maxDist,wallDistance);
 for(const enemy of enemies){if(!enemy.alive)continue;
  for(const zone of ZONES){
   const t=rayEllipsoid(origin,direction,{x:enemy.x+zone.cx,y:zone.cy,z:enemy.z+zone.cz},
       {x:zone.rx,y:zone.ry,z:zone.rz});
   if(t!==null&&t<nearest){nearest=t;best={enemy,zone:zone.name,multiplier:zone.mult,distance:t};}
  }
 }
 return best;
}
export function directionFromYawPitch(yaw,pitch){
 const cp=Math.cos(pitch);
 return {x:-Math.sin(yaw)*cp,y:Math.sin(pitch),z:-Math.cos(yaw)*cp};
}
