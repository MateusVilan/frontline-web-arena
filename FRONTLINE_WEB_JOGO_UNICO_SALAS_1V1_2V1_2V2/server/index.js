import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { MAPS,blocked,lineOfSight,angleDelta,navigateEnemy } from '../shared/maps.js';
import {traceEnemies,directionFromYawPitch} from '../shared/hitboxes.js';
import {safePlayerName, validateMotion, rayBodyIntersection, applyBulletDamage} from '../shared/pvp-rules.js';
import {respawnState,canReceiveBotDamage} from '../shared/respawn.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(__dirname,'..');
const PORT=Number(process.env.PORT||3000);
const LIMIT=65536;
const MAX_ROOMS=40;
const MAX_CONNECTIONS=80;
const RECONNECT_GRACE_MS=process.env.FRONTLINE_TEST_RECONNECT_MS ? Math.max(1000,Math.min(25000,Number(process.env.FRONTLINE_TEST_RECONNECT_MS)||25000)) : 25000; // production: 25 seconds for refresh/network interruption
const HEARTBEAT_MS=10000;
const HEARTBEAT_TIMEOUT_MS=30000;

let activeConnections=0;
const rooms=new Map();
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(){let s='';for(let i=0;i<6;i++)s+=ALPHABET[crypto.randomInt(ALPHABET.length)];return s;}
function out(ws,data){if(!ws?.alive)return;
 // Do not queue old snapshots behind a slow Internet connection.
 if(data.type==='STATE' && ws.socket.writableLength>65536)return;
 ws.send(JSON.stringify(data));}
function emit(room,data){const payload=JSON.stringify(data);for(const p of room.players.values())if(p.ws?.alive){
 // Drop outdated states before they form a backlog, but never drop hits/kills/respawns.
 if(data.type==='STATE'&&p.ws.socket.writableLength>32768)continue;
 p.ws.send(payload);
}}
function spawnEnemies(map,wave=1){if(MAPS[map]?.pvp)return [];const positions=MAPS[map].enemies;const arsenal=['m4','ak','mp9','m4','ak','mp9'];return Array.from({length:Math.min(6,3+wave)},(_,i)=>{const a=positions[(i+wave-1)%positions.length];return{id:i+1,x:a[0],z:a[1],yaw:Math.PI,weapon:arsenal[i%arsenal.length],health:90+wave*10,alive:true,walk:false,alert:0,cooldown:1+i*.3,step:0};});}
const ROOM_MODES={ '1v1':{size:2,blue:1,orange:1}, '2v1':{size:3,blue:2,orange:1}, '2v2':{size:4,blue:2,orange:2} };
function createRoom(map,{lobby=false,mode='1v1'}={}){let id;do{id=code()}while(rooms.has(id));const room={id,map,players:new Map(),enemies:spawnEnemies(map),wave:1,kills:0,lastBroadcast:0,seq:0,lobby:!!lobby&&!!MAPS[map].pvp,started:!lobby||!MAPS[map].pvp,gameMode:ROOM_MODES[mode]?mode:'1v1'};rooms.set(id,room);return room;}
function lobbyState(room){return{type:'LOBBY',code:room.id,mode:room.gameMode,map:room.map,started:room.started,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,host:p.host,online:!!p.ws?.alive}))};}
function broadcastLobby(room){if(room.lobby)emit(room,lobbyState(room));}
function lobbyCounts(room){const people=[...room.players.values()];return{blue:people.filter(p=>p.team==='blue').length,orange:people.filter(p=>p.team==='orange').length,total:people.length};}
function updateLobbySlots(room){let blue=0,orange=0;for(const p of room.players.values()){p.slot=p.team==='blue'?[0,2][blue++]:[1,3][orange++];out(p.ws,{type:'TEAM',team:p.team,slot:p.slot});}}
function allocateLobbyTeams(room){const caps=ROOM_MODES[room.gameMode];let blue=0,orange=0;for(const p of room.players.values()){const team=(blue<caps.blue&&(blue<=orange||orange>=caps.orange))?'blue':'orange';p.team=team;if(team==='blue')blue++;else orange++;}updateLobbySlots(room);}
function startLobby(room){const caps=ROOM_MODES[room.gameMode],counts=lobbyCounts(room);if(counts.total!==caps.size||counts.blue!==caps.blue||counts.orange!==caps.orange||[...room.players.values()].some(p=>!p.ws?.alive))return false;room.started=true;resetRoom(room,room.map,{preserveTeams:true});emit(room,{type:'LOBBY_STARTED',map:room.map,mode:room.gameMode});broadcastLobby(room);return true;}

// Only the currently bound socket has authority to move, fire or buy for a player.
// After a session takeover, delayed packets from the replaced socket are discarded.
function playerFor(ws){const room=rooms.get(ws.room);const p=room?.players.get(ws.pid);return{room,p:p?.ws===ws?p:null};}
function resetRoom(room,map,{preserveTeams=false}={}){if(!MAPS[map].pvp&&room.players.size>2){for(const p of room.players.values())if(p.host)out(p.ws,{type:'ERROR',message:'Este mapa cooperativo suporta 2 jogadores. Mantém uma arena PvP ou sai da sala com menos jogadores.'});return;}room.map=map;room.wave=1;room.kills=0;room.enemies=spawnEnemies(map);let i=0;for(const p of room.players.values()){if(!preserveTeams)p.team=MAPS[map].pvp?(i%2?'orange':'blue'):'blue';p.slot=preserveTeams&&MAPS[map].pvp?p.slot:i;const s=MAPS[map].spawn[p.slot%MAPS[map].spawn.length];i++;Object.assign(p,{x:s[0],z:s[1],yaw:p.team==='orange'?Math.PI/2:-Math.PI/2,pitch:0,jump:0,moving:false,hp:100,armor:0,money:800,kills:0,deaths:0,weapon:'m4',lastMove:Date.now(),moveCredit:.45,lastFire:0,lastCorrection:0,spawnShield:Date.now()+1200,history:[]});resetAmmo(p);out(p.ws,{type:'TEAM',team:p.team,slot:p.slot});}emit(room,{type:'MAP',map,reset:true});snapshot(room);}
function respawnPlayer(room, player, now=Date.now()) {
 player.deaths=(player.deaths||0)+1;
 const spawn=MAPS[room.map].spawn[player.slot] || MAPS[room.map].spawn[0];
 const notice=respawnState(player,spawn,now,1800);
 savePosition(player,now);
 out(player.ws,notice);
}
function assignSlot(room,player,team){
 const slots=team==='blue'?[0,2]:[1,3];
 return slots.find(slot=>![...room.players.values()].some(p=>p!==player&&p.slot===slot))??slots[0];
}
function rebalanceAfterExit(room){
 if(!MAPS[room.map].pvp||room.players.size<2)return;
 const list=[...room.players.values()];
 if(list.some(p=>p.team==='blue')&&list.some(p=>p.team==='orange'))return;
 // Two remaining allies would otherwise have no opponents: turn one into an enemy.
 const candidate=list[list.length-1];candidate.team=candidate.team==='blue'?'orange':'blue';
 candidate.slot=assignSlot(room,candidate,candidate.team);
 const s=MAPS[room.map].spawn[candidate.slot];
 Object.assign(candidate,{x:s[0],z:s[1],hp:100,armor:0,jump:0,spawnShield:Date.now()+1600});
 out(candidate.ws,{type:'TEAM',team:candidate.team,slot:candidate.slot});
 out(candidate.ws,{type:'RESPAWN',x:s[0],z:s[1],shield:1600});
 emit(room,{type:'NOTICE',message:'Equipas reequilibradas para continuar o duelo.'});
}
function removePlayer(room,p){
 room.players.delete(p.id);
 if(room.players.size===0){rooms.delete(room.id);return;}
 if(p.host){for(const member of room.players.values())member.host=false;
   // If the current host left permanently, prefer an online player.
   const successor=[...room.players.values()].find(x=>x.ws?.alive)||room.players.values().next().value;
   successor.host=true;out(successor.ws,{type:'HOST'});
 }
 if(!room.lobby||room.started)rebalanceAfterExit(room);
 emit(room,{type:'NOTICE',message:'Um jogador saiu da sala.'});broadcastLobby(room);snapshot(room);
}
function release(ws,grace=false){
 const{room,p}=playerFor(ws);if(!room||!p||p.ws!==ws)return;
 ws.room=null;ws.pid=null;
 if(grace){
   p.ws=null;p.offlineUntil=Date.now()+RECONNECT_GRACE_MS;
   emit(room,{type:'NOTICE',message:`${p.name} perdeu ligação. A aguardar reconexão…`});broadcastLobby(room);snapshot(room);
   return;
 }
 removePlayer(room,p);
}
function resumeSession(ws,code,token){
 const room=rooms.get(String(code||'').toUpperCase());
 // The browser can refresh before the previous WebSocket is actually closed.
 // Possession of the one-time token authorizes replacing that old connection.
 // Rotate it on every successful recovery to prevent token replay.
 const now=Date.now();
 const p=room&&[...room.players.values()].find(x=>x.session===token&&(x.ws?.alive||x.offlineUntil>now));
 if(!p){out(ws,{type:'ERROR',message:'A reconexão expirou ou a sala deixou de existir.'});return;}
 if(p.ws!==ws)release(ws);
 const old=p.ws;
 p.ws=ws;p.offlineUntil=0;p.session=crypto.randomBytes(24).toString('hex');
 p.lastMove=now;p.moveCredit=.45;p.spawnShield=now+1200;
 ws.room=room.id;ws.pid=p.id;
 if(old&&old!==ws&&old.alive)old.socket.destroy();
 out(ws,{type:'RESUMED',code:room.id,id:p.id,session:p.session,host:p.host,map:room.map,team:p.team,slot:p.slot,x:p.x,z:p.z,hp:p.hp,armor:p.armor,weapon:p.weapon,ammo:p.ammo,reloading:p.reloadWeapon,reloadRemaining:p.reloadWeapon?Math.max(0,p.reloadUntil-now):0,lobby:room.lobby&&!room.started,gameMode:room.gameMode});
 emit(room,{type:'NOTICE',message:`${p.name} voltou à partida.`});broadcastLobby(room);snapshot(room);
}
function expireSessions(){
 const now=Date.now();
 for(const room of [...rooms.values()]){
   for(const p of [...room.players.values()])if(!p.ws&&p.offlineUntil&&p.offlineUntil<=now){
     removePlayer(room,p);
   }
 }
}
function join(ws,room,name){if(room.lobby&&room.started)return out(ws,{type:'ERROR',message:'Partida em curso. Aguarda uma nova sala.'});const capacity=room.lobby?ROOM_MODES[room.gameMode].size:(MAPS[room.map].pvp?4:2);if(room.players.size>=capacity)return out(ws,{type:'ERROR',message:`Sala cheia (máximo ${capacity} jogadores).`});release(ws);const id=crypto.randomUUID().slice(0,8);const host=room.players.size===0;const team=MAPS[room.map].pvp?([...room.players.values()].filter(p=>p.team==='blue').length<=[...room.players.values()].filter(p=>p.team==='orange').length?'blue':'orange'):'blue';const slot=MAPS[room.map].pvp?([team==='blue'?0:1,team==='blue'?2:3].find(i=>![...room.players.values()].some(p=>p.slot===i))??0):(host?0:1);const s=MAPS[room.map].spawn[slot];const p={id,name:safePlayerName(name),ws,session:crypto.randomBytes(24).toString('hex'),offlineUntil:0,host,team,slot,x:s[0],z:s[1],yaw:team==='orange'?Math.PI/2:-Math.PI/2,pitch:0,jump:0,hp:100,armor:0,money:800,kills:0,deaths:0,lastFire:0,lastMove:Date.now(),moveCredit:.45,weapon:'m4',spawnShield:Date.now()+1200,history:[]};resetAmmo(p);room.players.set(id,p);savePosition(p);ws.room=room.id;ws.pid=id;out(ws,{type:'ROOM',code:room.id,id,session:p.session,host,map:room.map,team,slot,lobby:room.lobby&&!room.started,gameMode:room.gameMode});emit(room,{type:'NOTICE',message:host?'Sala criada. Partilha o código de 6 caracteres.':'Amigo ligado à sala.'});broadcastLobby(room);snapshot(room);}
function savePosition(p,now=Date.now()){
 if(!Array.isArray(p.history))p.history=[];
 const h=p.history,last=h[h.length-1];
 if(last&&Math.hypot(p.x-last.x,p.z-last.z)>3.2)h.length=0; // teleport/respawn
 h.push({t:now,x:p.x,z:p.z});
 while(h.length>10||h.length>1&&now-h[0].t>300)h.shift();
}
function pastPosition(p,when){
 const h=p.history;
 if(!h?.length)return{x:p.x,z:p.z};
 if(when<=h[0].t)return{x:h[0].x,z:h[0].z};
 if(when>=h[h.length-1].t)return{x:p.x,z:p.z};
 for(let i=1;i<h.length;i++){
  const a=h[i-1],b=h[i];if(when>b.t)continue;
  const mix=Math.max(0,Math.min(1,(when-a.t)/Math.max(1,b.t-a.t)));
  return{x:a.x+(b.x-a.x)*mix,z:a.z+(b.z-a.z)*mix};
 }
 return{x:p.x,z:p.z};
}
function getPlayerHit(room,shooter,yaw,pitch,maxDist=33,rewindMs=0){
 const ray=directionFromYawPitch(yaw,Math.max(-1.3,Math.min(1.3,pitch)));
 let closest=null,nearest=Infinity;
 const now=Date.now();
 for(const victim of room.players.values()){
   if(victim===shooter||!victim.ws?.alive)continue;
   const old=rewindMs?pastPosition(victim,now-Math.min(120,rewindMs)):{x:victim.x,z:victim.z};
   const along=rayBodyIntersection(shooter,ray,old,maxDist);
   if(along===null||along>=nearest)continue;
   if(!lineOfSight(room.map,shooter.x,shooter.z,old.x,old.z))continue;
   nearest=along;
   const y=1.65+ray.y*along;
   closest={victim,zone:y>1.72?'head':'torso',multiplier:y>1.72?1.85:1};
 }
 // A teammate is a physical obstacle: don't hit an enemy THROUGH an ally.
 if(!closest||closest.victim.team===shooter.team||closest.victim.spawnShield>now)return null;
 return closest;
}
function getRayHit(room, shooter, yaw, pitch=0, maxDist=28){
 const ray=directionFromYawPitch(yaw,Math.max(-1.3,Math.min(1.3,pitch)));
 const origin={x:shooter.x,y:1.65+(shooter.jump||0),z:shooter.z};
 const targets=room.enemies.filter(e=>e.alive&&lineOfSight(room.map,shooter.x,shooter.z,e.x,e.z));
 return traceEnemies(origin,ray,targets,maxDist);
}
const guns={
 m4:{rpm:600,dmg:34,mag:30,reloadMs:1550},
 ak:{rpm:570,dmg:43,mag:30,reloadMs:1750},
 mp9:{rpm:860,dmg:23,mag:30,reloadMs:1420},
 pistol:{rpm:260,dmg:38,mag:13,reloadMs:1200},
 knife:{rpm:110,dmg:75,mag:0,reloadMs:0}
};
function freshMagazines(){return Object.fromEntries(Object.entries(guns).map(([id,w])=>[id,w.mag]));}
function resetAmmo(p){p.ammo=freshMagazines();p.reloadWeapon=null;p.reloadUntil=0;}
function ammoStatus(p,now=Date.now()){
 return {type:'AMMO_SYNC',ammo:p.ammo,reloading:p.reloadWeapon,reloadRemaining:p.reloadWeapon?Math.max(0,p.reloadUntil-now):0};
}
// Acknowledge each locally predicted shot (including denied shots) so the HUD
// can reconcile ammunition without waiting for a full room snapshot.
function shotResult(ws,p,shot,accepted){
 if(!Number.isSafeInteger(shot.seq)||shot.seq<1)return;
 const weapon=String(shot.weapon||'');
 if(!guns[weapon]||!guns[weapon].mag)return;
 out(ws,{type:'SHOT_RESULT',seq:shot.seq,weapon,accepted,remaining:p.ammo[weapon]});
}
function completeReload(p,now=Date.now()){
 if(!p.reloadWeapon||now<p.reloadUntil)return false;
 p.ammo[p.reloadWeapon]=guns[p.reloadWeapon].mag;
 p.reloadWeapon=null;p.reloadUntil=0;
 out(p.ws,ammoStatus(p,now));
 return true;
}

function onPacket(ws,m){if(!m||typeof m.type!=='string')return;
 if(m.type==='CREATE'){if(rooms.size>=MAX_ROOMS)return out(ws,{type:'ERROR',message:'Servidor cheio. Tenta mais tarde.'});const map=MAPS[m.map]?m.map:'industrial';const wantsLobby=!!m.lobby&&!!MAPS[map].pvp;return join(ws,createRoom(map,{lobby:wantsLobby,mode:m.mode}),m.name);}
 if(m.type==='JOIN'){const room=rooms.get(String(m.code||'').toUpperCase());return room?join(ws,room,m.name):out(ws,{type:'ERROR',message:'Sala não encontrada. Confirma o código.'});}
 if(m.type==='LEAVE')return release(ws);
 if(m.type==='RESUME')return resumeSession(ws,m.code,m.session);
 if(m.type==='PING')return out(ws,{type:'PONG',time:Number.isFinite(m.time)?m.time:0});
 const{room,p}=playerFor(ws);if(!room||!p)return;
 if(m.type==='LOBBY_CONFIG'){
   if(!room.lobby||room.started||!p.host)return out(ws,{type:'ERROR',message:'Só o anfitrião configura a sala.'});
   const newMode=ROOM_MODES[m.mode]?m.mode:room.gameMode;
   const newMap=MAPS[m.map]?.pvp?m.map:room.map;
   if(room.players.size>ROOM_MODES[newMode].size)return out(ws,{type:'ERROR',message:'Há demasiados jogadores para esse modo.'});
   const modeChanged=newMode!==room.gameMode;room.gameMode=newMode;room.map=newMap;if(modeChanged)allocateLobbyTeams(room);broadcastLobby(room);return;
 }
 if(m.type==='LOBBY_TEAM'){
   if(!room.lobby||room.started||!p.host)return out(ws,{type:'ERROR',message:'Só o anfitrião pode escolher as equipas.'});
   const target=room.players.get(m.id),team=m.team;
   if(!target||!['blue','orange'].includes(team)||team===target.team)return;
   const cap=ROOM_MODES[room.gameMode][team],counts=lobbyCounts(room);
   if(counts[team]>=cap){
     // Swap with a teammate from the destination side instead of deadlocking
     // the 1v1 selector where both teams are already full.
     const swap=[...room.players.values()].find(other=>other!==target&&other.team===team);
     if(!swap)return out(ws,{type:'ERROR',message:'Não é possível alterar esta equipa.'});
     swap.team=target.team;
   }
   target.team=team;updateLobbySlots(room);broadcastLobby(room);return;
 }
 if(m.type==='LOBBY_START'){
   if(!room.lobby||room.started||!p.host)return;
   if(!startLobby(room))out(ws,{type:'ERROR',message:'Faltam jogadores ou as equipas não têm a composição do modo escolhido.'});return;
 }
 if(room.lobby&&!room.started)return;
 if(m.type==='MAP'&&p.host&&MAPS[m.map])return resetRoom(room,m.map);
 if(m.type==='MOVE'){
   if(!Number.isFinite(m.x)||!Number.isFinite(m.z))return;
   const now=Date.now(),dt=Math.max(0,Math.min(.25,(now-p.lastMove)/1000));
   const movement=validateMotion(room.map,p,m.x,m.z,dt,blocked);
   p.moveCredit=movement.credit;
   if(movement.allowed){p.x=m.x;p.z=m.z;}
   else if(Math.hypot(m.x-p.x,m.z-p.z)>.14 && now-(p.lastCorrection||0)>160){
     // Client prediction got desynchronised (wall collision, packet burst, or lag).
     // Returning the authoritative position prevents permanent rubber-banding.
     p.lastCorrection=now;
     out(ws,{type:'MOVE_CORRECTION',x:p.x,z:p.z});
   }
   p.yaw=Number.isFinite(m.yaw)?m.yaw:p.yaw;p.pitch=Number.isFinite(m.pitch)?Math.max(-1.3,Math.min(1.3,m.pitch)):0;
   p.jump=Number.isFinite(m.jump)?Math.max(0,Math.min(1.3,m.jump)):0;
   completeReload(p,now);
   const equipped=guns[m.weapon]?m.weapon:'m4';
   if(equipped!==p.weapon&&p.reloadWeapon){p.reloadWeapon=null;p.reloadUntil=0;}
   p.weapon=equipped;p.moving=!!m.moving;p.lastMove=now;savePosition(p,now);return;
 }
 if(m.type==='RELOAD'){
   const now=Date.now();completeReload(p,now);
   const gun=guns[p.weapon];
   // Always reply: otherwise the client could keep playing a reload animation
   // that the server rejected (for example after a lost/too-fast shot).
   if(!gun||!gun.mag||p.reloadWeapon||p.ammo[p.weapon]>=gun.mag){out(ws,ammoStatus(p,now));return;}
   p.reloadWeapon=p.weapon;p.reloadUntil=now+gun.reloadMs;
   out(ws,ammoStatus(p,now));
   return;
 }
 if(m.type==='BUY'){
   let success=false, message='ARTIGO NÃO DISPONÍVEL';
   if(m.item==='armor'){
     if(p.armor>=100)message='JÁ TENS COLETE COMPLETO';
     else if(p.money<650)message='SALDO INSUFICIENTE PARA O COLETE';
     else{p.money-=650;p.armor=100;success=true;message='COLETE EQUIPADO';}
   }else if(m.item==='health'){
     if(p.hp>=100)message='JÁ TENS A VIDA COMPLETA';
     else if(p.money<400)message='SALDO INSUFICIENTE PARA O KIT';
     else{p.money-=400;p.hp=Math.min(100,p.hp+50);success=true;message='VIDA RECUPERADA';}
   }
   out(ws,{type:'BUY_RESULT',success,item:m.item,message,money:p.money,armor:p.armor,hp:p.hp});
   return;
 }
 if(m.type==='SHOT'){
   const gun=guns[m.weapon];if(!gun||m.weapon==='knife')return;
   // Require the weapon to match the last authoritative MOVE packet.
   if(p.weapon!==m.weapon){shotResult(ws,p,m,false);return;}
   const now=Date.now();completeReload(p,now);
   if(p.reloadWeapon||!p.ammo[m.weapon]){shotResult(ws,p,m,false);out(ws,ammoStatus(p,now));return;}
   const cool=60000/gun.rpm-12;if(now-p.lastFire<cool){shotResult(ws,p,m,false);return;}
   p.lastFire=now;p.ammo[m.weapon]--;
   shotResult(ws,p,m,true);
   const angle=Number.isFinite(m.yaw)?m.yaw:p.yaw;
   const aimPitch=Number.isFinite(m.pitch)?m.pitch:p.pitch;
   const hit=MAPS[room.map].pvp?getPlayerHit(room,p,angle,aimPitch,33,90):getRayHit(room,p,angle,aimPitch,28);
   emit(room,{type:'FIRE',id:p.id,weapon:m.weapon,x:p.x,z:p.z});
   if(hit&&MAPS[room.map].pvp){
     const victim=hit.victim;applyBulletDamage(victim,gun.dmg*hit.multiplier,hit.zone);
     out(p.ws,{type:'HIT',x:victim.x,z:victim.z,enemy:victim.id,zone:hit.zone});
     if(victim.hp<=0){p.kills++;p.money+=300;room.kills++;emit(room,{type:'KILL',killer:p.id,victim:victim.id,team:p.team,weapon:m.weapon});
       respawnPlayer(room,victim);
     }
   }else if(hit){const victim=hit.enemy;victim.health-=gun.dmg*hit.multiplier;victim.alert=10;out(p.ws,{type:'HIT',x:victim.x,z:victim.z,enemy:victim.id,zone:hit.zone});if(victim.health<=0){victim.alive=false;p.kills++;p.money+=300;room.kills++;}}
   return;
 }
 if(m.type==='KNIFE'){
   if(p.weapon!=='knife')return;
   const now=Date.now();if(now-p.lastFire<440)return;p.lastFire=now;
   const hit=MAPS[room.map].pvp?getPlayerHit(room,p,p.yaw,p.pitch,1.7,65):getRayHit(room,p,p.yaw,p.pitch,1.7);
   emit(room,{type:'FIRE',id:p.id,weapon:'knife',x:p.x,z:p.z});
   if(hit&&MAPS[room.map].pvp){const v=hit.victim;v.hp=Math.max(0,v.hp-guns.knife.dmg);out(p.ws,{type:'HIT',zone:'torso'});
     if(v.hp<=0){p.kills++;p.money+=300;room.kills++;emit(room,{type:'KILL',killer:p.id,victim:v.id,team:p.team,weapon:'knife'});respawnPlayer(room,v);}}
   else if(hit){const v=hit.enemy;v.health-=guns.knife.dmg;v.alert=10;if(v.health<=0){v.alive=false;p.kills++;p.money+=300;room.kills++;}}return;
 }
}
function snapshot(room){for(const p of room.players.values())completeReload(p);emit(room,{type:'STATE',seq:++room.seq,map:room.map,wave:room.wave,kills:room.kills,players:[...room.players.values()].map(p=>({id:p.id,online:!!p.ws?.alive,team:p.team,x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,jump:p.jump||0,weapon:p.weapon,moving:p.moving||false,name:p.name,hp:p.hp,armor:p.armor,money:p.money,kills:p.kills,deaths:p.deaths||0})),enemies:room.enemies.map(e=>({id:e.id,x:e.x,z:e.z,yaw:e.yaw,weapon:e.weapon,health:e.health,alive:e.alive,walk:e.walk}))});}
function step(room,dt){
 if(room.lobby&&!room.started)return;
 if(MAPS[room.map].pvp){room.lastBroadcast+=dt;if(room.lastBroadcast>=1/20){room.lastBroadcast%=1/20;snapshot(room);}return;}
 for(const e of room.enemies){
  if(!e.alive)continue;
  const candidates=[...room.players.values()].filter(p=>p.hp>0&&p.ws?.alive).sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z));
  if(!candidates.length)continue;
  const target=candidates[0],dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1,desired=Math.atan2(-dx,-dz);
  e.cooldown-=dt;e.alert=Math.max(0,e.alert-dt);
  const visible=d<17&&Math.abs(angleDelta(desired,e.yaw))<Math.PI*.32&&lineOfSight(room.map,e.x,e.z,target.x,target.z);
  if(visible)e.alert=10;
  e.sightTime=visible?Math.min(2,(e.sightTime||0)+dt):0;
  if(e.alert>0){
    e.walk=navigateEnemy(room.map,e,{x:target.x,z:target.z},dt,1.22);
    if(!e.walk)e.yaw+=angleDelta(desired,e.yaw)*Math.min(1,dt*3);
  }else {e.walk=false;e.yaw+=Math.sin(Date.now()*.0005+e.id)*dt*.2;}
  if(visible&&e.sightTime>.19&&d<13&&e.cooldown<=0){
    e.cooldown=1+Math.random()*.65;
    // Bot shots are not guaranteed hits: target movement, cover breaks and range matter.
    const chance=Math.max(.43,Math.min(.91,.94-d*.023-(target.moving?.09:0)));
    emit(room,{type:'ENEMY_FIRE',id:e.id,x:e.x,z:e.z,weapon:e.weapon});
    // A newly respawned player cannot be damaged during the brief shield window.
    if(!canReceiveBotDamage(target)||Math.random()>chance)continue;
    const dmg=4+Math.round(Math.random()*7),absorb=Math.min(target.armor,dmg*.48);
    target.armor=Math.max(0,target.armor-absorb);target.hp=Math.max(0,target.hp-dmg+absorb);
    if(target.hp<=0){
      respawnPlayer(room,target);
      emit(room,{type:'NOTICE',message:`${target.name} reapareceu na base.`});
    }
  }
 }
 if(room.enemies.every(e=>!e.alive)){room.wave++;room.enemies=spawnEnemies(room.map,room.wave);for(const p of room.players.values())p.money+=500;emit(room,{type:'NOTICE',message:`Onda ${room.wave} — +$500`});}
 room.lastBroadcast+=dt;
 if(room.lastBroadcast>=1/15){room.lastBroadcast-=1/15;snapshot(room);}
}
// Lightweight WS implementation to keep the project install-free; only handles masked text frames,
// ping/pong, and close, with a strict message size limit. Intended for prototype rooms, not public hosting.
function frame(op,data=Buffer.alloc(0)){if(typeof data==='string')data=Buffer.from(data);const n=data.length;const head=n<126?Buffer.from([128|op,n]):n<65536?Buffer.from([128|op,126,n>>8,n&255]):Buffer.from([128|op,127,0,0,0,0,(n/2**24)&255,(n>>16)&255,(n>>8)&255,n&255]);return Buffer.concat([head,data]);}
function handleSocket(socket){
 activeConnections++;
 socket.setNoDelay(true);
 const ws={alive:true,socket,buffer:Buffer.alloc(0),room:null,pid:null,lastPong:Date.now(),rateStart:Date.now(),rateCount:0,send:s=>{if(ws.alive)socket.write(frame(1,s));}};
 socket.on('data',chunk=>{ws.buffer=Buffer.concat([ws.buffer,chunk]);if(ws.buffer.length>LIMIT*2){socket.destroy();return;}while(ws.buffer.length>=2){const b=ws.buffer,opcode=b[0]&15,masked=!!(b[1]&128);let size=b[1]&127,offset=2;if(size===126){if(b.length<4)break;size=b.readUInt16BE(2);offset=4;}else if(size===127){if(b.length<10)break;const big=b.readBigUInt64BE(2);if(big>BigInt(LIMIT)){socket.destroy();return;}size=Number(big);offset=10;}if(!masked){socket.destroy();return;}if(size>LIMIT){socket.destroy();return;}if(b.length<offset+4+size)break;const key=b.subarray(offset,offset+4),body=Buffer.from(b.subarray(offset+4,offset+4+size));for(let i=0;i<size;i++)body[i]^=key[i%4];ws.buffer=b.subarray(offset+4+size);if(opcode===8){socket.end(frame(8));return;}if(opcode===9){ws.lastPong=Date.now();socket.write(frame(10,body));continue;}if(opcode===10){ws.lastPong=Date.now();continue;}if(opcode!==1)continue;const now=Date.now();if(now-ws.rateStart>1000){ws.rateStart=now;ws.rateCount=0;}if(++ws.rateCount>100){socket.destroy();return;}try{onPacket(ws,JSON.parse(body.toString('utf8')));}catch{out(ws,{type:'ERROR',message:'Mensagem inválida.'});}}});
 const closed=()=>{if(!ws.alive)return;ws.alive=false;activeConnections=Math.max(0,activeConnections-1);release(ws,true);};socket.on('close',closed);socket.on('error',closed);return ws;
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.glb':'model/gltf-binary','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(pathname==='/')pathname='/public/index.html';
 if(!pathname.startsWith('/public/')&&!pathname.startsWith('/src/')&&!pathname.startsWith('/shared/')){res.writeHead(404);res.end('Not found');return;}
 const file=path.resolve(ROOT,'.'+pathname);
 // Check the canonical resolved path against the requested PUBLIC subtree;
 // checking only ROOT previously made /public/%2e%2e%2fserver/index.js readable.
 const section=pathname.split('/')[1];const allowedRoot=path.resolve(ROOT,section);
 if(!['public','src','shared'].includes(section)||!file.startsWith(allowedRoot+path.sep)){
  res.writeHead(403);res.end('Acesso negado');return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Ficheiro não encontrado');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:data);});
});
server.on('upgrade',(req,socket)=>{if(req.url!=='/ws'||activeConnections>=MAX_CONNECTIONS){socket.destroy();return;}const key=req.headers['sec-websocket-key'];
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}}
 if(!key||req.headers['upgrade']?.toLowerCase()!=='websocket'||req.headers['sec-websocket-version']!=='13'||Buffer.from(key,'base64').length!==16){socket.destroy();return;}const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');const ws=handleSocket(socket);connections.add(ws);socket.on('close',()=>connections.delete(ws));});
setInterval(()=>{for(const r of rooms.values())step(r,.05);},50);
setInterval(expireSessions,1000).unref();
// Browser WebSockets automatically answer native ping frames. Drop half-open TCP
// connections so the room stops showing ghost players after a network outage.
const connections=new Set();
// The connection set is populated at upgrade time and pruned on socket close.
setInterval(()=>{const now=Date.now();for(const ws of connections){
 if(!ws.alive){connections.delete(ws);continue;}
 if(now-ws.lastPong>HEARTBEAT_TIMEOUT_MS){ws.socket.destroy();continue;}
 if(!ws.socket.destroyed&&ws.socket.writableLength<32768)ws.socket.write(frame(9,Buffer.from('fw')));
}},HEARTBEAT_MS).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`CS2 Web Rebuild: http://localhost:${PORT} (servidor de salas ativo)`));
