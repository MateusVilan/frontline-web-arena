import http from 'node:http';
import {randomInt,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {MAPS,MODES,WEAPONS,sweepMove,moveSpeed} from './public/maps.js';
import {canStartRoom,traceHit,shotSpread,canFireNow} from './public/combat.js';
import {rememberPosition,historicalPosition,rewindAt} from './public/lag.js';
import {teamForJoin,distributeTeams,switchTeam} from './public/teams.js';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const port=Number(process.env.PORT||3000);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent((req.url||'/').split('?')[0]);}catch{res.writeHead(400).end('Bad request');return;}
 const relative=pathname==='/'?'index.html':pathname.slice(1);
 const filepath=path.resolve(root,relative);
 if (!(filepath===root||filepath.startsWith(root+path.sep))) {res.writeHead(403).end();return;}
 fs.stat(filepath,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(filepath)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(filepath).pipe(res);
 });
});
const wss=new WebSocketServer({server,maxPayload:4096,perMessageDeflate:false});
const rooms=new Map();let nextID=0;
function send(ws,obj){if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<131072)ws.send(JSON.stringify(obj));}
function broadcast(room,obj){const msg=JSON.stringify(obj);for(const p of room.players.values())if(p.ws?.readyState===WebSocket.OPEN&&p.ws.bufferedAmount<131072)p.ws.send(msg);}
function code(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c;
 do{c=Array.from({length:5},()=>alphabet[randomInt(alphabet.length)]).join('')}while(rooms.has(c));return c;}
function makePlayer(ws,room,name){const id=String(++nextID);return {id,ws,room,token:randomBytes(18).toString('hex'),disconnectedAt:0,name:String(name||'JOGADOR').trim().slice(0,16)||'JOGADOR',team:'A',x:3.5,z:10.5,yaw:0,pitch:0,crouch:false,slow:false,weapon:'rifle',ammo:{rifle:30,pistol:13},hp:100,kills:0,deaths:0,shotAt:0,reloadAt:0,reloadWeapon:null,equipReadyAt:0,lastMove:Date.now(),moveBudget:.35,lastMotion:0,velocity:0,alive:true,history:[]};}
function publicPlayer(p){return {id:p.id,name:p.name,team:p.team,connected:!!p.ws,x:+p.x.toFixed(3),z:+p.z.toFixed(3),yaw:+p.yaw.toFixed(3),pitch:+p.pitch.toFixed(3),crouch:p.crouch,slow:p.slow,weapon:p.weapon,hp:p.hp,alive:p.alive,kills:p.kills,deaths:p.deaths,ammo:p.ammo[p.weapon]??0}}
function roomInfo(room){return {t:'room',now:Date.now(),code:room.code,mode:room.mode,map:room.map,state:room.state,host:room.host,score:room.score,winner:room.winner||null,round:room.round,ends:room.ends,players:[...room.players.values()].map(publicPlayer)};}
function stateUpdate(room){broadcast(room,roomInfo(room));}
function spawn(room){const m=MAPS[room.map];let ai=0,bi=0;for(const p of room.players.values()){
  const n=p.team==='A'?ai++:bi++;const [x,z]=m.spawns[p.team][n%2];
  p.x=x;p.z=z;p.yaw=p.team==='A'?-Math.PI/2:Math.PI/2;p.pitch=0;p.crouch=false;p.weapon='rifle';p.hp=100;p.alive=true;
  p.ammo={rifle:30,pistol:13};p.lastMove=Date.now();p.moveBudget=.35;p.lastMotion=0;p.velocity=0;p.shotAt=0;p.reloadAt=0;p.reloadWeapon=null;p.equipReadyAt=0;p.slow=false;p.history=[];rememberPosition(p,Date.now());
 }}
function startRound(room){room.winner=null;room.round++;room.state='playing';room.ends=Date.now()+90000;spawn(room);stateUpdate(room);}
function roundEnd(room,winner){if(room.state!=='playing')return;room.state='roundover';room.winner=winner;room.ends=Date.now()+3200;
 if(winner)room.score[winner]++;
 broadcast(room,{t:'result',winner,score:room.score});
 if(room.score.A>=5||room.score.B>=5){room.state='matchover';room.ends=0;stateUpdate(room);}else stateUpdate(room);
}
function checkRound(room){if(room.state!=='playing')return;
 const alive={A:0,B:0};for(const p of room.players.values())if(p.alive)alive[p.team]++;
 if(!alive.A||!alive.B)roundEnd(room,alive.A?'A':alive.B?'B':null);
}
function removePlayer(p){const room=p.room;room.players.delete(p.id);if(p.ws){p.ws.player=null;p.ws=null;}
 if(!room.players.size){rooms.delete(room.code);return;}
 if(room.host===p.id)room.host=room.players.keys().next().value;
 if(room.state!=='lobby'&&room.players.size<MODES[room.mode].max){room.state='lobby';room.score={A:0,B:0};room.round=0;room.ends=0;}
 if(room.state==='playing')checkRound(room);
 stateUpdate(room);
}
function leave(ws){const p=ws.player;if(p)removePlayer(p);}
function disconnect(ws){const p=ws.player;if(!p)return;ws.player=null;p.ws=null;
 p.disconnectedAt=Date.now();stateUpdate(p.room);
}
function error(ws,message){send(ws,{t:'error',message});}
function join(ws,room,name){if(ws.player){error(ws,'Já estás numa sala.');return;}
 if(room.players.size>=MODES[room.mode].max){error(ws,'Esta sala está cheia.');return;}
 if(room.state!=='lobby'){error(ws,'Jogo em curso. Espera por outra sala.');return;}
 const team=teamForJoin(room);if(!team){error(ws,'Não há vagas disponíveis nesta sala.');return;}
 const p=makePlayer(ws,room,name);p.team=team;room.players.set(p.id,p);ws.player=p;
 send(ws,{t:'welcome',id:p.id,session:p.token,code:room.code});stateUpdate(room);
}
function resume(ws,codeValue,token){if(ws.player)return;
 const room=rooms.get(String(codeValue||'').trim().toUpperCase());
 const player=room&&[...room.players.values()].find(p=>p.token===token);
 if(!player){error(ws,'A sessão anterior expirou. Entra novamente numa sala.');return;}
 if(player.ws&&player.ws!==ws){const old=player.ws;old.player=null;old.terminate();}
 player.ws=ws;player.disconnectedAt=0;player.lastMove=Date.now();player.moveBudget=.35;player.lastMotion=0;player.velocity=0;ws.player=player;
 send(ws,{t:'welcome',id:player.id,session:player.token,code:room.code});stateUpdate(room);
}
function shot(p,msg){const room=p.room;if(room.state!=='playing'||!p.alive)return;
 const w=WEAPONS[p.weapon];const now=Date.now();if(!canFireNow(p,now))return;
 if(p.weapon!=='knife'&&p.ammo[p.weapon]<=0){send(p.ws,{t:'dry'});return;}
 p.shotAt=now;if(p.weapon!=='knife')p.ammo[p.weapon]--;
 const yaw=Number.isFinite(msg.yaw)?Math.max(-1000,Math.min(1000,msg.yaw)):p.yaw;
 const pitch=Number.isFinite(msg.pitch)?Math.max(-1.35,Math.min(1.35,msg.pitch)):p.pitch;
 p.yaw=yaw;p.pitch=pitch;
 const recentSpeed=now-p.lastMotion<190?p.velocity:0;
 const spread=shotSpread(p.weapon,recentSpeed,p.crouch);
 // Recuamos apenas os adversários, nunca a posição do atirador nem as paredes.
 // A latência é medida no servidor por WebSocket ping/pong (não fornecida pelo cliente).
 const shotTime=p.weapon==='knife'?now:rewindAt(now,p.ws?.rttMs);
 const targets=[...room.players.values()].map(target=>{
   if(target.id===p.id)return target;
   const old=historicalPosition(target,shotTime);
   return {id:target.id,team:target.team,alive:target.alive,x:old.x,z:old.z,crouch:old.crouch};
 });
 const target=traceHit(MAPS[room.map],targets,p,yaw+spread.yaw,pitch+spread.pitch,w.range);let hit=null;
 if(target){const victim=room.players.get(target.player.id);
  // O alvo pode ter sido eliminado entretanto; não pode sofrer dano duas vezes.
  if(victim?.alive){
  const dmg=Math.round(w.damage*(target.head?1.8:1));victim.hp=Math.max(0,victim.hp-dmg);
  hit={id:victim.id,damage:dmg,head:target.head};
  if(victim.hp===0){victim.alive=false;victim.deaths++;p.kills++;broadcast(room,{t:'kill',attacker:p.name,victim:victim.name,weapon:p.weapon,head:target.head});}
  }
 }
 broadcast(room,{t:'fire',from:p.id,weapon:p.weapon,hit});
 send(p.ws,{t:'ammo',weapon:p.weapon,amount:p.ammo[p.weapon]??0,done:false});
 if(hit)checkRound(room);
}
function onPacket(ws,m){const p=ws.player;
 if(m.t==='resume'){resume(ws,m.code,m.session);return;}
 if(m.t==='create'){if(p)return;const mode=Object.hasOwn(MODES,m.mode)?m.mode:'1v1';const map=Object.hasOwn(MAPS,m.map)?m.map:'dockyard';
  if(rooms.size>=200){error(ws,'O servidor está cheio. Tenta novamente.');return;}
  const room={code:code(),mode,map,players:new Map(),host:'',state:'lobby',score:{A:0,B:0},round:0,ends:0};rooms.set(room.code,room);
  join(ws,room,m.name);room.host=ws.player.id;stateUpdate(room);return;
 }
 if(m.t==='join'){const room=rooms.get(String(m.code||'').trim().toUpperCase());if(!room){error(ws,'Código de sala inválido.');return;}
  join(ws,room,m.name);return;
 }
 if(!p)return;const room=p.room;
 if(m.t==='leave'){leave(ws);return;}
 if(m.t==='config'&&p.id===room.host&&room.state==='lobby'){
  if(Object.hasOwn(MAPS,m.map))room.map=m.map;
  if(Object.hasOwn(MODES,m.mode)&&room.players.size<=MODES[m.mode].max&&room.mode!==m.mode){
   room.mode=m.mode;distributeTeams(room);
  }
  stateUpdate(room);return;
 }
 if(m.t==='team'&&p.id===room.host&&room.state==='lobby'){
  if(switchTeam(room,m.id))stateUpdate(room);return;
 }
 if(m.t==='start'&&p.id===room.host&&(room.state==='lobby'||room.state==='matchover')){
  if(!canStartRoom(room)){error(ws,`Precisam de ${MODES[room.mode].max} jogadores ligados para ${room.mode}.`);return;}
  room.round=0;room.score={A:0,B:0};startRound(room);return;
 }
 if(m.t==='ping'){send(ws,{t:'pong',stamp:m.stamp});return;}
 if(m.t==='move'&&room.state==='playing'&&p.alive){const now=Date.now();let dx=Number(m.x)-p.x,dz=Number(m.z)-p.z;
  const delta=Math.max(0,Math.min(.20,(now-p.lastMove)/1000));p.lastMove=now;
  if(!Number.isFinite(dx)||!Number.isFinite(dz))return;
  p.crouch=!!m.crouch;p.slow=!!m.slow;
  // Orçamento por tempo real: inundar o servidor com pacotes não aumenta a velocidade.
  p.moveBudget=Math.min(.55,p.moveBudget+delta*moveSpeed(p.weapon,p.slow,p.crouch)*1.12);
  const dist=Math.hypot(dx,dz),permitted=Math.min(dist,p.moveBudget);
  if(dist>0){dx*=permitted/dist;dz*=permitted/dist;}
  const dest=sweepMove(MAPS[room.map],p.x,p.z,dx,dz);
  p.moveBudget=Math.max(0,p.moveBudget-Math.hypot(dest.x-p.x,dest.z-p.z));
  const travelled=Math.hypot(dest.x-p.x,dest.z-p.z);
  p.velocity=delta>.001?Math.min(7,travelled/delta):0;
  if(travelled>.002)p.lastMotion=now;
  p.x=dest.x;p.z=dest.z;rememberPosition(p,now);
  if(Number.isFinite(m.yaw))p.yaw=Math.max(-1e4,Math.min(1e4,m.yaw));
  if(Number.isFinite(m.pitch))p.pitch=Math.max(-1.35,Math.min(1.35,m.pitch));
  return;
 }
 if(m.t==='equip'&&room.state==='playing'&&p.alive&&Object.hasOwn(WEAPONS,m.weapon)){
  if(p.weapon===m.weapon)return;
  p.weapon=m.weapon;p.equipReadyAt=Date.now()+WEAPONS[m.weapon].draw*1000;p.reloadAt=0;p.reloadWeapon=null;return;}
 if(m.t==='reload'&&room.state==='playing'&&p.alive&&p.weapon!=='knife'){
  const w=WEAPONS[p.weapon];if(p.ammo[p.weapon]>=w.ammo||p.reloadAt>Date.now())return;
  p.reloadWeapon=p.weapon;p.reloadAt=Date.now()+w.reload*1000;send(ws,{t:'reload',weapon:p.weapon,duration:w.reload});return;
 }
 if(m.t==='fire')shot(p,m);
}
wss.on('connection',ws=>{ws.lastPacket=Date.now();ws.packets=0;ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true;if(ws.pingSentAt){const elapsed=Date.now()-ws.pingSentAt;ws.rttMs=ws.rttMs===undefined?elapsed:ws.rttMs*.7+elapsed*.3;ws.pingSentAt=0;}});ws.on('message',data=>{let m;try{m=JSON.parse(data.toString())}catch{return;}
 const now=Date.now();if(now-ws.lastPacket>=1000){ws.lastPacket=now;ws.packets=0;}
 if(++ws.packets>100)return;
 if(!m||typeof m!=='object'||typeof m.t!=='string')return;
 try{onPacket(ws,m)}catch(e){console.error('Packet error:',e);error(ws,'Falha ao processar pedido.');}});
 ws.on('close',()=>disconnect(ws));ws.on('error',()=>disconnect(ws));});
// Fechar sockets abandonados liberta lugares; o cliente tenta reentrar na mesma sala.
const heartbeat=setInterval(()=>{for(const client of wss.clients){if(client.isAlive===false){client.terminate();continue;}client.isAlive=false;try{client.pingSentAt=Date.now();client.ping()}catch{client.terminate()}}},5000);
wss.on('close',()=>clearInterval(heartbeat));
setInterval(()=>{const now=Date.now();for(const room of rooms.values()){
 for(const p of [...room.players.values()])if(!p.ws&&p.disconnectedAt&&now-p.disconnectedAt>12000)removePlayer(p);
 if(!rooms.has(room.code))continue;
 if(room.state==='playing'){
  for(const p of room.players.values())if(p.reloadAt&&now>=p.reloadAt){const weapon=p.reloadWeapon;
   if(WEAPONS[weapon]){p.ammo[weapon]=WEAPONS[weapon].ammo;send(p.ws,{t:'ammo',weapon,amount:p.ammo[weapon],done:true});}
   p.reloadAt=0;p.reloadWeapon=null;}
  if(now>=room.ends){const sums={A:0,B:0};for(const p of room.players.values())if(p.alive)sums[p.team]+=p.hp;
   roundEnd(room,sums.A>sums.B?'A':sums.B>sums.A?'B':null);
  }
  if(room.state==='playing')broadcast(room,{t:'snap',now,ends:room.ends,players:[...room.players.values()].map(publicPlayer)});
 }else if(room.state==='roundover'&&now>=room.ends&&canStartRoom(room))startRound(room);
 }
},65);
server.listen(port,'0.0.0.0',()=>console.log(`FRONTLINE WEB ARENA → http://localhost:${port}`));
