// Fast wall proximity for first-person viewmodels.
// The avatar's weapon is *always* visible. Wall proximity only tucks the
// weapon down/back; it never suppresses shooting or its mesh.
export const weaponReach={m4:2.15,ak:2.08,mp9:1.82,pistol:1.32,knife:1.45};
export function clearance2D(grid,x,z,dx,dz,{maxRange=2.6,step=.12,halfWidth=.19}={}){
 const length=Math.hypot(dx,dz);
 if(!length || !grid?.length) return maxRange;
 const fx=dx/length,fz=dz/length,rx=-fz,rz=fx;
 // Sample the centre and narrow sides of the weapon, not the full width of a corridor.
 for(let d=step;d<=maxRange+1e-6;d+=step){
  for(const offset of [-halfWidth,0,halfWidth]){
   const tx=Math.floor(x+fx*d+rx*offset),tz=Math.floor(z+fz*d+rz*offset);
   if(tz<0||tx<0||tz>=grid.length||tx>=grid[0].length||grid[tz][tx]!==0) return Math.min(d,maxRange);
  }
 }
 return maxRange;
}
export function weaponWallPose(distance,weapon='m4'){
 const reach=weaponReach[weapon]??weaponReach.m4;
 // The gun moves towards the torso before touching the obstruction.
 const overlap=Math.max(0,reach-distance+.16);
 const retract=Math.min(1.05,overlap);
 const avoid=Math.min(1,overlap/.95);
 return {avoid,hide:false,retract,clearance:distance};
}
