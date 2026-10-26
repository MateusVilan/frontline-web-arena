/** Small independent gameplay rules shared with tests. */
export function safePlayerName(value){
 const clean=String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,16);
 return clean||'JOGADOR';
}
export function validateMotion(map,p,nx,nz,dt,isBlocked){
 // Token bucket allows short packet-loss bursts but not cumulative speed hacks.
 const credit=Math.min(1.15,Math.max(0,Number(p.moveCredit)||0)+Math.min(.25,Math.max(0,dt))*5.5);
 if(!Number.isFinite(nx)||!Number.isFinite(nz))return{allowed:false,credit};
 const distance=Math.hypot(nx-p.x,nz-p.z);
 if(distance>credit+.00001)return{allowed:false,credit};
 const steps=Math.max(1,Math.ceil(distance/.10));
 for(let i=1;i<=steps;i++){
  const t=i/steps;
  if(isBlocked(map,p.x+(nx-p.x)*t,p.z+(nz-p.z)*t,.23))return{allowed:false,credit};
 }
 return{allowed:true,credit:Math.max(0,credit-distance)};
}
export function rayBodyIntersection(shooter,ray,position,maxDist){
 const dx=position.x-shooter.x,dz=position.z-shooter.z;
 const along=dx*ray.x+dz*ray.z;
 if(along<=.20||along>=maxDist)return null;
 if(Math.abs(dx*ray.z-dz*ray.x)>.43)return null;
 const y=1.65+ray.y*along;
 if(y<.12||y>2.03)return null;
 return along;
}

/** In PvP the vest absorbs up to 48% of body-shot damage.
 * Headshots and knife damage are not stopped by the vest. Damage is server authoritative. */
export function applyBulletDamage(player,damage,zone='torso'){
 const raw=Number.isFinite(damage)?Math.max(0,damage):0;
 const armor=Math.max(0,Number(player.armor)||0);
 const absorbed=zone==='head'?0:Math.min(armor,raw*.48);
 player.armor=Math.max(0,armor-absorbed);
 player.hp=Math.max(0,(Number(player.hp)||0)-(raw-absorbed));
 return {hp:player.hp,armor:player.armor,absorbed};
}
