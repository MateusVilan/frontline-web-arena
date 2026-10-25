/* Colisões de disparo e dispersão calculadas no servidor. Sem dependências do browser. */
import {blockAt,MODES,WEAPONS} from './maps.js';
import {teamsReady} from './teams.js';

export function canStartRoom(room){
 const mode=MODES[room.mode];
 return !!mode&&room.players.size===mode.max&&teamsReady(room)&&[...room.players.values()].every(p=>p.ws?.readyState===1);
}

/** Um raio percorre o mapa em pequenos passos; caixas protegem jogadores agachados. */
export function traceHit(map,players,shooter,yaw,pitch,range){
 const eye=shooter.crouch?1.08:1.66;
 const dirX=-Math.sin(yaw)*Math.cos(pitch);
 const dirZ=-Math.cos(yaw)*Math.cos(pitch);
 const dirY=Math.sin(pitch);
 for(let d=.12;d<=range;d+=.10){
  const x=shooter.x+dirX*d,z=shooter.z+dirZ*d,y=eye+dirY*d;
  if(y<0||y>3.3)break;
  const block=blockAt(map,x,z);
  if(block==='#'||(block==='c'&&y<1.28))break;
  for(const p of players){
   if(!p.alive||p.id===shooter.id)continue;
   // Golpes corpo a corpo respeitam a distância entre jogadores, não apenas a borda da hitbox.
   if(range<=2&&Math.hypot(p.x-shooter.x,p.z-shooter.z)>range)continue;
   const h=p.crouch?1.15:1.8;
   if((p.x-x)**2+(p.z-z)**2<.16&&y>.18&&y<h){
    // Sem fogo amigo, mas os colegas bloqueiam os projéteis: não há tiros fantasma.
    if(p.team===shooter.team)return null;
    return {player:p,head:y>h-.37};
   }
  }
 }
 return null;
}

/** Precisão por arma e deslocação real validada no servidor, não declarada pelo cliente. */
export function shotSpread(weapon,speed=0,crouch=false,random=Math.random){
 if(weapon==='knife')return {yaw:0,pitch:0};
 const base=weapon==='rifle'?.004:.0025;
 const motion=Math.min(1,Math.max(0,speed)/5);
 const cone=(base+(weapon==='rifle'?.019:.013)*motion)*(crouch?.65:1);
 return {yaw:(random()-.5)*2*cone,pitch:(random()-.5)*2*cone};
}

/** O cooldown é validado com relógio do servidor; trocar ou recarregar não permite disparar antes do tempo. */
export function canFireNow(player,now){
 const w=WEAPONS[player.weapon];
 return !!w&&player.alive&&now >= (player.equipReadyAt||0)&&now >= (player.reloadAt||0)&&now-(player.shotAt||0)>=w.cooldown*1000-12;
}
