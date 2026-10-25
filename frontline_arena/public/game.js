import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {MAPS,MODES,WEAPONS,sweepMove,moveSpeed} from './maps.js';
import {spectatorCandidates,nextSpectatorId,spectatorCameraPose} from './spectator.js';
import {pixelRatio} from './render.js';
const $=id=>document.getElementById(id);
const el={menu:$('menu'),lobby:$('lobby'),pause:$('pause'),settings:$('settings'),hud:$('hud'),notice:$('centerNotice'),crosshair:$('crosshair')};
const settingDefaults={sens:5,volume:25,footsteps:20,resolution:80,fpsCap:60,fov:76};
let settings={...settingDefaults};try{settings={...settings,...JSON.parse(localStorage.getItem('fw-settings')||'{}')}}catch{}
for(const [key,min,max] of [['sens',1,12],['volume',0,100],['footsteps',0,100],['resolution',50,100],['fov',70,100]]){
 const val=Number(settings[key]);settings[key]=Number.isFinite(val)?Math.max(min,Math.min(max,val)):settingDefaults[key];
}
if(![0,30,45,60,90,120].includes(Number(settings.fpsCap)))settings.fpsCap=60;
let ws=null,myID=null,room=null,active=false,locked=false,world=null,resumePending=false,local={x:3.5,z:10.5,yaw:-Math.PI/2,pitch:0,hp:100,alive:true,team:'A',weapon:'rifle',ammo:{rifle:30,pistol:13},reloading:0,crouch:false,jumpY:0,jumpV:0,walk:0,stepTimer:0,inspect:0,draw:0,recoil:0,flash:0};
const remotes=new Map(),keys=Object.create(null);
let last=performance.now(),lastRender=0,sendAccumulator=0,fireTimer=0,frameCount=0,fpsAccum=0,elapsed=0,lastPing=0;
let lastMini=0,miniBackground=null,serverClockOffset=0,clockReady=false;
let isFiring=false,viewWeapon=null,scene,camera,renderer,weaponRoot,light,ambient,lastScoreUpdate=0;
let spectatorId=null;
const bright=new THREE.Color('#cce9db');
const geoBox=new THREE.BoxGeometry(1,1,1), geoCylinder=new THREE.CylinderGeometry(1,1,1,10), geoSphere=new THREE.SphereGeometry(1,10,7), geoKnifeTip=new THREE.ConeGeometry(.046,.23,4),geoFlash=new THREE.SphereGeometry(.1,7,5);
function makeMat(color,rough=0.84){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:.14});}
const matFlash=new THREE.MeshBasicMaterial({color:0xffe4a0});
const charMats={A:new THREE.MeshStandardMaterial({color:0x8debb2,roughness:.85}),B:new THREE.MeshStandardMaterial({color:0xffa56c,roughness:.85}),pants:new THREE.MeshStandardMaterial({color:0x25313d}),helmet:new THREE.MeshStandardMaterial({color:0x252b2c})};
const mats={metal:makeMat(0x384c57,.47),dark:makeMat(0x171f28,.59),grip:makeMat(0x131c21),rail:makeMat(0x5a757d,.42),gold:makeMat(0xb8a16d,.4),glove:makeMat(0x303a30),skin:makeMat(0xbd926b),blade:makeMat(0xbfd3d4,.27)};
function show(node,on){node.classList.toggle('hidden',!on)}
// Escala efetiva: nos monitores a 100% de DPI, o controlo de resolução também tem de funcionar.
function renderPixelRatio(){return pixelRatio(window.devicePixelRatio||1,settings.resolution);}
function availableSpectators(){return spectatorCandidates(room,local.team,myID,remotes.keys());}
function pickSpectator(direction=0){
 const candidates=availableSpectators();
 spectatorId=nextSpectatorId(candidates,spectatorId,direction);
 const followed=candidates.find(p=>p.id===spectatorId)||null;
 // Jogador eliminado nunca vê os adversários através do modo espectador.
 weaponRoot.visible=local.alive;
 show($('spectatorInfo'),!local.alive);
 if(!local.alive){
  $('spectatorInfo').textContent=followed?`A ESPECTAR ${followed.name} · Q / E MUDAR`:'ELIMINADO · AGUARDA O PRÓXIMO ROUND';
  el.notice.textContent=followed?'':'ELIMINADO';
 }
 return followed;
}
function syncClock(now){if(!Number.isFinite(now))return;const sample=now-Date.now();if(!clockReady){serverClockOffset=sample;clockReady=true;}else serverClockOffset+=Math.max(-150,Math.min(150,sample-serverClockOffset))*.05;}
function msg(text){const t=$('toast');t.textContent=text;t.style.opacity='1';clearTimeout(msg.id);msg.id=setTimeout(()=>t.style.opacity='0',2700)}
function status(text,color){$('connectStatus').textContent=text;$('connectStatus').style.color=color||'#a4b9ba'}
function send(obj){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function clearSession(){try{sessionStorage.removeItem('fw-session')}catch{}}
function connect(){
 const scheme=location.protocol==='https:'?'wss':'ws';
 ws=new WebSocket(`${scheme}://${location.host}`);
 ws.addEventListener('open',()=>{status('Ligado ao servidor · Pronto para jogar','#b5f6a6');$('createBtn').disabled=false;$('joinBtn').disabled=false;
  const code=new URLSearchParams(location.search).get('room');if(code)$('roomCodeInput').value=code.toUpperCase().slice(0,5);
  try{const previous=JSON.parse(sessionStorage.getItem('fw-session')||'null');
   if(previous?.code&&previous?.session){resumePending=true;send({t:'resume',code:previous.code,session:previous.session});status('A recuperar a sessão…','#b5f6a6');}
  }catch{clearSession();}
 });
 ws.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return;}handlePacket(m)});
 ws.addEventListener('close',()=>{status('Sem ligação. A tentar reconectar…','#ffb395');if(active)msg('Ligação ao servidor perdida');
 myID=null;room=null;active=false;show(el.menu,true);show(el.lobby,false);show(el.pause,false);show(el.hud,false);el.crosshair.style.display='none';
 if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
 $('createBtn').disabled=true;$('joinBtn').disabled=true;setTimeout(connect,1700)});
 ws.addEventListener('error',()=>status('Erro de ligação ao servidor','#ffb395'));
}
function handlePacket(m){
 if(m.t==='error'){if(resumePending){resumePending=false;clearSession();status('Sessão expirada · Podes criar ou entrar noutra sala','#ffb395');}
  msg(m.message);$('lobbyHelp').textContent=m.message;return;}
 if(m.t==='pong'){
  const rtt=performance.now()-Number(m.stamp);
  if(Number.isFinite(rtt)&&rtt>=0&&rtt<10000){$('ping').textContent=`${Math.round(rtt)} MS`;$('ping').classList.toggle('high',rtt>120);}
  return;
 }
 if(m.t==='welcome'){myID=m.id;resumePending=false;
  if(m.session&&m.code)try{sessionStorage.setItem('fw-session',JSON.stringify({session:m.session,code:m.code}));}catch{}
  return;}
 if(m.t==='room'){
  syncClock(m.now);
  const oldState=room?.state,oldMap=room?.map;room=m;
  if(!world||world.id!==room.map)buildWorld(MAPS[room.map]);
  updateScore();
  if(room.state==='lobby'){
   spectatorId=null;show($('spectatorInfo'),false);active=false;show(el.menu,false);show(el.lobby,true);show(el.pause,false);show(el.hud,false);
   el.crosshair.style.display='none';if(document.pointerLockElement)document.exitPointerLock();updateLobby();return;
  }
  if(room.state==='matchover'){
    spectatorId=null;show($('spectatorInfo'),false);active=false;show(el.lobby,false);show(el.menu,false);show(el.pause,true);show(el.hud,true);
    $('pause').querySelector('h2').textContent=`VENCEU A EQUIPA ${room.score.A>room.score.B?'A':'B'}`;
    $('resume').textContent=room.host===myID?'JOGAR REVANCHE':'À ESPERA DO HOST';$('resume').disabled=room.host!==myID;
    el.notice.textContent='FIM DA PARTIDA';if(document.pointerLockElement)document.exitPointerLock();return;
  }
  if(room.state==='playing'){
   active=true;show(el.menu,false);show(el.lobby,false);show(el.hud,true);
   if(oldState!=='playing'){
    const me=room.players.find(p=>p.id===myID);if(me)resetSelf(me);
    for(const obj of remotes.values())scene.remove(obj.group);remotes.clear();const roundText=`ROUND ${room.round}`;el.notice.textContent=roundText;
    setTimeout(()=>{if(el.notice.textContent===roundText)el.notice.textContent=''},1800);
    $('pause').querySelector('h2').textContent='JOGO EM PAUSA';$('resume').disabled=false;$('resume').textContent='VOLTAR AO JOGO →';
    show(el.pause,!locked);
   }
  }
  if(room.state==='roundover'){
   active=false;el.notice.textContent=room.players.some(p=>!p.connected)?'A AGUARDAR RECONEXÃO…':room.winner?`ROUND PARA EQUIPA ${room.winner}`:'FIM DO ROUND · EMPATE';
   // Manter o pointer-lock entre rounds evita um clique extra em cada ronda.
   spectatorId=null;show($('spectatorInfo'),false);show(el.pause,false);isFiring=false;
  }
  return;
 }
 if(m.t==='snap'&&room){syncClock(m.now);room.ends=m.ends;room.players=m.players;if(performance.now()-lastScoreUpdate>500){updateScore();lastScoreUpdate=performance.now();}const myself=m.players.find(p=>p.id===myID);
  if(myself){local.hp=myself.hp;local.alive=myself.alive;local.team=myself.team;el.crosshair.style.display=locked&&local.alive?'block':'none';
   const correction=Math.hypot(local.x-myself.x,local.z-myself.z);
   if(correction>1.25){local.x=myself.x;local.z=myself.z;}
   else if(correction>.38){local.x+=(myself.x-local.x)*.14;local.z+=(myself.z-local.z)*.14;}
   local.ammo[myself.weapon]=myself.ammo;
   if(!local.alive){pickSpectator();}else{spectatorId=null;show($('spectatorInfo'),false);weaponRoot.visible=true;}
  }
  const alive=new Set();for(const p of m.players){if(p.id===myID)continue;alive.add(p.id);setRemote(p)};
  for(const [id,obj] of remotes)if(!alive.has(id)){scene.remove(obj.group);remotes.delete(id)};
  updateHud();return;
 }
 if(m.t==='ammo'){if(Object.hasOwn(local.ammo,m.weapon))local.ammo[m.weapon]=m.amount;
  if(m.done&&m.weapon===local.weapon)local.reloading=0;updateHud();return;}
 if(m.t==='reload'){if(m.weapon===local.weapon)local.reloading=m.duration;return;}
 if(m.t==='fire'){
  if(m.from!==myID){const p=remotes.get(m.from);if(p){p.muzzle=0.06;positionalShot(p.group.position.distanceTo(camera.position));}}
  if(m.from===myID&&m.hit){
   const marker=$('hitmark'),info=$('damagePopup');
   marker.textContent=m.hit.head?'✹':'✕';marker.classList.toggle('head',!!m.hit.head);
   marker.style.opacity='1';clearTimeout(marker._timer);marker._timer=setTimeout(()=>marker.style.opacity='0',130);
   info.textContent=`${m.hit.head?'HEADSHOT · ':''}${m.hit.damage} DANO`;info.style.opacity='1';
   clearTimeout(info._timer);info._timer=setTimeout(()=>info.style.opacity='0',750);sound('hit');}
  return;
 }
 if(m.t==='kill'){const entry=document.createElement('div');entry.textContent=`${m.attacker}  ✦  ${m.victim}${m.head?' · HS':''}`;$('killfeed').prepend(entry);setTimeout(()=>entry.remove(),3800);return;}
 if(m.t==='result'){el.notice.textContent=m.winner?`ROUND PARA EQUIPA ${m.winner}`:'EMPATE';return;}
}
function resetSelf(p){local.x=p.x;local.z=p.z;local.yaw=p.yaw;local.pitch=p.pitch;local.hp=p.hp;local.alive=true;
 local.weapon='rifle';local.ammo={rifle:30,pistol:13};local.reloading=0;local.crouch=false;local.jumpY=0;local.jumpV=0;local.walk=0;local.recoil=0;local.draw=0;
 local.stepTimer=0;local.flash=0;fireTimer=0;isFiring=false;spectatorId=null;show($('spectatorInfo'),false);weaponRoot.visible=true;
 camera.rotation.order='YXZ';camera.rotation.y=local.yaw;camera.rotation.x=local.pitch;equip('rifle',false);}
function updateScore(){if(!room)return;
 $('roomName').textContent=`${room.code} · ${MAPS[room.map]?.name||'ARENA'}`;
 $('matchScore').innerHTML=`${room.score.A} <em>:</em> ${room.score.B}`;
 $('scoreContent').innerHTML=room.players.map(p=>`<div class="scoreRow"><b>${p.team}</b><span>${html(p.name)}${p.id===room.host?' ★':''}</span><span>${p.kills} K</span><span>${p.deaths} D</span></div>`).join('');
}
function html(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function updateLobby(){if(!room)return;
 $('roomCodeDisplay').textContent=room.code;$('lobbyMode').textContent=room.mode.toUpperCase();$('lobbyMap').textContent=MAPS[room.map].name;
 $('lobbyCount').textContent=`${room.players.length} / ${MODES[room.mode].max}`;
 $('lobbyPlayers').innerHTML=room.players.map(p=>`<div class="lobbyPlayer"><span><b>${p.team}</b> · ${html(p.name)} ${p.id===room.host?'♛':''}</span><span class="playerActions"><small>${p.id===myID?'TU':p.connected?'LIGADO':'A REENTRAR'}</small>${room.host===myID?`<button type="button" class="teamSwap" data-player="${html(p.id)}" title="Mudar de equipa">↔ EQUIPA</button>`:''}</span></div>`).join('');
 const host=room.host===myID;show($('hostConfig'),host);show($('startMatch'),host);
 $('hostMode').value=room.mode;$('hostMap').value=room.map;
 const full=room.players.length===MODES[room.mode].max,allOnline=room.players.every(p=>p.connected);
 $('startMatch').disabled=!full||!allOnline;
 $('lobbyHelp').textContent=!full?`Faltam ${MODES[room.mode].max-room.players.length} jogador(es) para começar.`:!allOnline?'A aguardar que todos voltem a ligar-se.':(host?'Tudo pronto. Podes começar!':'À espera que o host comece.');
 history.replaceState(null,'',`${location.pathname}?room=${room.code}`);
}
function mesh(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
function setup3D(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x8aa3ab);scene.fog=new THREE.FogExp2(0x8aa3ab,.017);
 camera=new THREE.PerspectiveCamera(settings.fov,innerWidth/innerHeight,.065,80);camera.rotation.order='YXZ';
 renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance',stencil:false});
 renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(renderPixelRatio());
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 $('viewport').appendChild(renderer.domElement);
 ambient=new THREE.HemisphereLight(0xd5eef5,0x515149,2.1);scene.add(ambient);
 light=new THREE.DirectionalLight(0xffedcd,2.15);light.position.set(-17,28,-13);scene.add(light);
 scene.add(camera);weaponRoot=new THREE.Group();weaponRoot.position.set(.32,-.32,-.66);camera.add(weaponRoot);
 equip('rifle',false);
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(renderPixelRatio());});
}
function buildWorld(map){
 if(world){scene.remove(world.group);
  world.group.traverse(o=>{if(o.geometry&&o.geometry!==geoBox&&o.geometry!==geoCylinder&&o.geometry!==geoSphere)o.geometry.dispose();
   if(o.material){for(const mat of (Array.isArray(o.material)?o.material:[o.material]))mat.dispose();}});
  for(const p of remotes.values())scene.remove(p.group);remotes.clear();}
 const group=new THREE.Group();scene.add(group);
 const wallMat=makeMat(map.theme==='dock'?0x546977:0x706b61), crateMat=makeMat(map.theme==='dock'?0x94704a:0x715f47),floorMat=makeMat(map.theme==='dock'?0x606c69:0x696b60);
 const plane=new THREE.PlaneGeometry(map.width,map.height);
 const ground=new THREE.Mesh(plane,floorMat);ground.rotation.x=-Math.PI/2;ground.position.set(map.width/2,-.035,map.height/2);group.add(ground);
 const positions={wall:[],crate:[]};for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++){
  const c=map.grid[z][x];if(c==='#')positions.wall.push([x+.5,z+.5]);if(c==='c')positions.crate.push([x+.5,z+.5]);
 }
 for(const [kind,pos] of Object.entries(positions)){
  const h=kind==='wall'?3.4:1.28,m=new THREE.InstancedMesh(geoBox,kind==='wall'?wallMat:crateMat,pos.length);m.frustumCulled=false;
  const dummy=new THREE.Object3D(),tint=new THREE.Color();
  pos.forEach(([x,z],i)=>{dummy.position.set(x,h/2,z);dummy.scale.set(1,h,1);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);
   tint.setHSL(kind==='wall'?.56:.084,.12+(i%5)*.01,.40+(i%4)*.02);m.setColorAt(i,tint)});
  m.instanceMatrix.needsUpdate=true;group.add(m);
 }
 // Faixas do chão: geometria única, sem criar centenas de draw calls.
 const verts=[];for(let x=1;x<map.width;x+=2)verts.push(x,.003,1,x,.003,map.height-1);
 for(let z=1;z<map.height;z+=2)verts.push(1,.003,z,map.width-1,.003,z);
 const lines=new THREE.BufferGeometry();lines.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 group.add(new THREE.LineSegments(lines,new THREE.LineBasicMaterial({color:0x9aa8a3,transparent:true,opacity:.10})));
 // Destaques de zona / luz sem luzes dinâmicas nem sombras.
 const stripeA=makeMat(0x7dbfa1),stripeB=makeMat(0xd89567);
 mesh(group,geoBox,stripeA,1.2,.018,map.height/2,1.6,.03,6);
 mesh(group,geoBox,stripeB,map.width-1.2,.018,map.height/2,1.6,.03,6);
 // Silhuetas industriais fora dos limites jogáveis, sem luzes/sombras dinâmicas.
 if(map.theme==='dock'){
  const teal=makeMat(0x466d78),orange=makeMat(0x965b3d),edges=makeMat(0xb8a26b);
  for(const [x,z,w,col] of [[5,-2,5,teal],[13,-2.3,6,orange],[24,-1.9,5,teal],[8,map.height+1.7,7,orange],[22,map.height+1.6,6,teal]]){
    mesh(group,geoBox,col,x,1.55,z,w,3.1,2.2);
    for(let yy=.45;yy<3;yy+=.66)mesh(group,geoBox,edges,x,yy,z+1.12,w,.028,.025);
  }
  for(const x of [4,24]){
   mesh(group,geoBox,edges,x,5.5,-4,.24,10,.25);
   mesh(group,geoBox,edges,x+3.1,10.1,-4,6.4,.22,.25);
   mesh(group,geoBox,edges,x+5,7,-4,.1,6,.14);
  }
 }else{
  const copper=makeMat(0x8b5d42),slate=makeMat(0x3c4649),glow=makeMat(0xbd6e3b);
  for(const [x,z,h] of [[4,-4,8],[20,-4,11],[8,map.height+4,9],[26,map.height+3,7]]){
   mesh(group,geoCylinder,slate,x,h/2,z,.86,h,.86);
   mesh(group,geoCylinder,copper,x,h-.6,z,1,.18,1);
   mesh(group,geoCylinder,glow,x,h-.93,z,.94,.11,.94);
  }
  for(const z of [-2.5,map.height+2]){
   mesh(group,geoBox,slate,map.width/2,5.4,z,18,.34,.48);
   for(const x of [5,12,20,26])mesh(group,geoBox,copper,x,2.7,z,.36,5.4,.35);
  }
 }
 world={id:map.id,map,group};
 buildMiniMap(map);
}
function buildMiniMap(map){
 miniBackground=document.createElement('canvas');miniBackground.width=174;miniBackground.height=126;
 const g=miniBackground.getContext('2d'),cw=174/map.width,ch=126/map.height;
 g.fillStyle='#142127';g.fillRect(0,0,174,126);
 for(let z=0;z<map.height;z++)for(let x=0;x<map.width;x++){
  const c=map.grid[z][x];if(c==='.')continue;
  g.fillStyle=c==='#'?'#71828a':'#927755';g.fillRect(x*cw+.2,z*ch+.2,cw-.4,ch-.4);
 }
 for(const team of ['A','B']){
  g.fillStyle=team==='A'?'#8dfab2':'#ffa777';g.font='bold 11px system-ui';
  const [x,z]=map.spawns[team][0];g.fillText(team,x*cw-4,z*ch-6);
 }
}
function drawMiniMap(){if(!room||!world||!miniBackground)return;
 const c=$('minimap'),g=c.getContext('2d');g.clearRect(0,0,174,126);g.drawImage(miniBackground,0,0);
 const sx=174/world.map.width,sz=126/world.map.height;
 for(const p of room.players){if(!p.alive||p.team!==local.team||p.id===myID)continue;
  g.fillStyle='#b7ef9d';g.beginPath();g.arc(p.x*sx,p.z*sz,3.4,0,Math.PI*2);g.fill();
 }
 const observed=!local.alive&&spectatorId?room.players.find(p=>p.id===spectatorId):null;
 g.save();g.translate((observed?.x??local.x)*sx,(observed?.z??local.z)*sz);g.rotate(-(observed?.yaw??local.yaw));
 g.fillStyle='#ffffff';g.strokeStyle='#203b31';g.lineWidth=1.4;
 g.beginPath();g.moveTo(0,-7);g.lineTo(-4,5);g.lineTo(4,5);g.closePath();g.fill();g.stroke();g.restore();
}
function character(data){
 const g=new THREE.Group();const material=charMats[data.team]||charMats.A,pants=charMats.pants,helmet=charMats.helmet;
 mesh(g,geoBox,pants,0,.85,0,.53,.52,.30);
 mesh(g,geoBox,material,0,1.27,0,.66,.79,.37);
 mesh(g,geoSphere,helmet,0,1.91,0,.29,.30,.29);
 mesh(g,geoBox,mats.dark,0,1.89,-.21,.45,.16,.1);
 const larm=mesh(g,geoBox,material,-.45,1.26,0,.2,.70,.22),rarm=mesh(g,geoBox,material,.45,1.26,0,.2,.70,.22);
 const left=mesh(g,geoBox,pants,-.17,.43,0,.23,.81,.24),right=mesh(g,geoBox,pants,.17,.43,0,.23,.81,.24);
 mesh(g,geoBox,mats.dark,.02,1.35,-.27,.57,.14,.12);
 const muzzleFlash=new THREE.Mesh(geoFlash,matFlash);muzzleFlash.position.set(.02,1.30,-.67);muzzleFlash.visible=false;g.add(muzzleFlash);
 g.position.set(data.x,0,data.z);scene.add(g);
 return {group:g,left,right,larm,rarm,targetX:data.x,targetZ:data.z,targetYaw:data.yaw,crouch:data.crouch,slow:!!data.slow,alive:data.alive,hp:data.hp,phase:Math.random()*5,muzzle:0,stepTimer:Math.random()*.4,
  samples:[],moving:false,muzzleFlash};
}
function setRemote(data){let v=remotes.get(data.id);
 if(!v){v=character(data);remotes.set(data.id,v)}
 const at=performance.now(),lastSample=v.samples[v.samples.length-1];
 if(lastSample&&Math.hypot(lastSample.x-data.x,lastSample.z-data.z)>4)v.samples=[];
 v.samples.push({x:data.x,z:data.z,yaw:data.yaw,at});
 if(v.samples.length>8)v.samples.shift();
 v.targetX=data.x;v.targetZ=data.z;v.targetYaw=data.yaw;v.pitch=data.pitch;v.crouch=data.crouch;v.slow=!!data.slow;v.alive=data.alive;v.hp=data.hp;
 v.group.visible=data.alive&&(local.alive||data.id!==spectatorId);
}
function makeWeapon(type){const g=new THREE.Group();g.userData.type=type;
 if(type==='rifle'){
  mesh(g,geoBox,mats.dark,0,0,-.27,.22,.16,.65); // receiver
  mesh(g,geoBox,mats.metal,0,.045,-.74,.13,.11,.74); // barrel housing
  const barrel=mesh(g,geoCylinder,mats.dark,0,.045,-1.15,.045,.39,.045);barrel.rotation.x=Math.PI/2;
  mesh(g,geoBox,mats.grip,0,-.15,-.19,.10,.33,.12).rotation.x=-.18;
  mesh(g,geoBox,mats.metal,0,-.25,-.48,.12,.38,.12).rotation.x=.15;
  mesh(g,geoBox,mats.dark,0,.14,-.36,.07,.11,.21);mesh(g,geoBox,mats.rail,0,.09,-.62,.20,.035,.61);
  mesh(g,geoBox,mats.glove,.21,-.22,-.55,.22,.17,.33);mesh(g,geoBox,mats.glove,-.17,-.18,-.09,.23,.19,.25);
 }else if(type==='pistol'){
  mesh(g,geoBox,mats.metal,0,.025,-.44,.16,.14,.48);
  mesh(g,geoBox,mats.dark,0,-.075,-.34,.17,.10,.39);
  mesh(g,geoBox,mats.grip,0,-.27,-.20,.13,.42,.16).rotation.x=-.25;
  mesh(g,geoBox,mats.gold,0,.11,-.64,.07,.04,.08);
  mesh(g,geoBox,mats.glove,.16,-.38,-.11,.26,.19,.20);
 }else{
  // Lâmina inclinada e cabos separados, pose butterfly junto à câmara.
  const grip1=mesh(g,geoBox,mats.dark,-.045,-.13,-.28,.07,.08,.38);grip1.rotation.y=.1;
  mesh(g,geoBox,mats.gold,-.045,-.09,-.45,.075,.08,.085);
  const blade=mesh(g,geoBox,mats.blade,-.046,-.055,-.73,.052,.04,.51);blade.rotation.y=.06;
  const tip=new THREE.Mesh(geoKnifeTip,mats.blade);
  tip.rotation.x=-Math.PI/2;tip.position.set(-.046,-.058,-1.07);g.add(tip);
  mesh(g,geoBox,mats.glove,.17,-.26,-.32,.27,.2,.34);
  mesh(g,geoBox,mats.glove,-.16,-.24,-.19,.24,.17,.28);
 }
 if(type!=='knife'){const glow=new THREE.Mesh(geoFlash,matFlash);glow.position.set(0,.04,type==='pistol'?-.79:-1.36);glow.visible=false;g.add(glow);g.userData.flash=glow;}
 return g;
}
function equip(type,notify=true){if(!WEAPONS[type]||local.weapon===type&&viewWeapon?.userData.type===type)return;
 if(viewWeapon)weaponRoot.remove(viewWeapon);viewWeapon=makeWeapon(type);weaponRoot.add(viewWeapon);
 local.weapon=type;local.draw=WEAPONS[type].draw;local.inspect=0;local.reloading=0;
 if(notify)send({t:'equip',weapon:type});updateHud();}
function updateHud(){if(!room)return;
 const watched=!local.alive&&spectatorId?room.players.find(p=>p.id===spectatorId):null;
 const shown=watched||local;
 $('healthValue').textContent=Math.max(0,shown.hp);$('healthFill').style.width=Math.max(0,shown.hp)+'%';
 $('weaponName').textContent=WEAPONS[shown.weapon]?.name||WEAPONS.rifle.name;
 const weapon=shown.weapon;
 const ammo=watched?watched.ammo:local.ammo[weapon];
 $('ammoValue').innerHTML=weapon==='knife'?'∞':`${ammo??0} <small>/ ${WEAPONS[weapon]?.ammo??30}</small>`;
 $('reloadInfo').textContent=watched?'MODO ESPECTADOR':local.reloading>0?'A RECARREGAR…':'';
 const secs=Math.max(0,Math.ceil((room.ends-(Date.now()+serverClockOffset))/1000));$('timer').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
}
function tryFire(){if(!active||!locked||!local.alive||local.reloading>0||local.draw>0||fireTimer>0)return;
 const type=local.weapon,w=WEAPONS[type];if(type!=='knife'&&local.ammo[type]<=0){sound('empty');fireTimer=.2;return;}
 fireTimer=w.cooldown;local.recoil=1;local.flash=.055;
 if(type!=='knife')local.ammo[type]--;send({t:'fire',yaw:local.yaw,pitch:local.pitch});
 if(type==='rifle')local.pitch=Math.min(1.3,local.pitch+.013+Math.random()*.006);
 if(type==='pistol')local.pitch=Math.min(1.3,local.pitch+.027);
 sound(type==='knife'?'knife':type==='rifle'?'rifle':'pistol');updateHud();
}
function reload(){if(!active||!local.alive||local.weapon==='knife'||local.reloading>0)return;
 if(local.ammo[local.weapon]>=WEAPONS[local.weapon].ammo)return;
 send({t:'reload'});local.reloading=WEAPONS[local.weapon].reload;sound('reload');}
function update(dt){if(!room||room.state!=='playing'||!world)return;
 const crouch=!!keys.ControlLeft||!!keys.ControlRight;
 const walk=!!keys.ShiftLeft||!!keys.ShiftRight;
 local.crouch=crouch;
 if(active&&locked&&local.alive){
  let forward=0,right=0;if(keys.KeyW)forward++;if(keys.KeyS)forward--;if(keys.KeyD)right++;if(keys.KeyA)right--;
  if(forward||right){const len=Math.hypot(forward,right);forward/=len;right/=len;}
  const speed=moveSpeed(local.weapon,walk,crouch);
  const dx=(-Math.sin(local.yaw)*forward+Math.cos(local.yaw)*right)*speed*dt;
  const dz=(-Math.cos(local.yaw)*forward-Math.sin(local.yaw)*right)*speed*dt;
  const moved=sweepMove(world.map,local.x,local.z,dx,dz);local.x=moved.x;local.z=moved.z;
  if(!crouch&&keys.Space&&local.jumpY===0){local.jumpV=4.15;local.jumpY=.001;}
  local.jumpV-=10.5*dt;local.jumpY=Math.max(0,local.jumpY+local.jumpV*dt);if(local.jumpY<=0)local.jumpV=0;
  const moving=forward||right;
  if(moving&&local.jumpY===0){local.walk+=dt*(walk?6:10.5);local.stepTimer-=dt;
   if(local.stepTimer<=0){local.stepTimer=walk?.67:.45;sound('step',walk?0.45:1);}}
  else local.stepTimer=.04;
  if(isFiring)tryFire();
 }
 // A pose da câmara é calculada DEPOIS de interpolar os colegas.
 // Isto evita seguir coordenadas antigas e o modo espectador parado no cadáver.
 local.recoil=Math.max(0,local.recoil-dt*6);local.flash=Math.max(0,local.flash-dt);
 local.draw=Math.max(0,local.draw-dt);local.inspect=Math.max(0,local.inspect-dt);
 local.reloading=Math.max(0,local.reloading-dt);fireTimer=Math.max(0,fireTimer-dt);
 // Vista da arma perto do jogador, sem atravessar o enquadramento.
 weaponRoot.position.set(.34+Math.sin(local.walk)*.009,-.34+Math.abs(Math.sin(local.walk))*.008,-.71+local.recoil*.035);
 weaponRoot.rotation.set(local.recoil*.14,0,local.recoil*.08);
 if(local.weapon==='knife'){weaponRoot.position.x=.27;weaponRoot.position.y=-.26;weaponRoot.rotation.y=-.13;}
 if(local.draw>0){weaponRoot.position.y-=local.draw*1.1;weaponRoot.rotation.x-=local.draw*1.4;}
 if(local.inspect>0){const u=1-local.inspect/1.35;const a=Math.sin(Math.PI*Math.min(1,Math.max(0,u)));
  weaponRoot.rotation.y+=a*(local.weapon==='knife'?2.7:1.1);weaponRoot.rotation.z+=a*.33;weaponRoot.position.x-=a*.14;}
 if(viewWeapon){viewWeapon.rotation.x=local.weapon==='knife'&&local.recoil>0?-local.recoil*1.1:0;
  if(viewWeapon.userData.flash)viewWeapon.userData.flash.visible=local.flash>0;}
  for(const obj of remotes.values()){
  // Reproduz as posições recebidas ~100 ms atrás: sem saltos devido ao jitter.
  const targetTime=performance.now()-100,arr=obj.samples;
  while(arr.length>2&&arr[1].at<=targetTime)arr.shift();
  let targetX=obj.targetX,targetZ=obj.targetZ,desired=obj.targetYaw;
  if(arr.length>=2){const a=arr[0],b=arr[1];const t=Math.max(0,Math.min(1,(targetTime-a.at)/Math.max(1,b.at-a.at)));
   targetX=a.x+(b.x-a.x)*t;targetZ=a.z+(b.z-a.z)*t;
   const diff=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));desired=a.yaw+diff*t;
  }
  const oldX=obj.group.position.x,oldZ=obj.group.position.z;
  obj.group.position.x=targetX;obj.group.position.z=targetZ;
  obj.group.rotation.y=desired;
  obj.group.visible=obj.alive&&(local.alive||obj!==remotes.get(spectatorId));
  const blend=Math.min(1,dt*12);
  obj.group.scale.y+=( (obj.crouch?.66:1)-obj.group.scale.y)*blend;
  obj.muzzle=Math.max(0,obj.muzzle-dt);obj.muzzleFlash.visible=obj.muzzle>0;
  obj.phase+=dt*8;const moving=Math.hypot(obj.targetX-obj.group.position.x,obj.targetZ-obj.group.position.z)>.012;
  const walking=Math.hypot(oldX-targetX,oldZ-targetZ)>dt*.38||moving;
  const swing=walking?Math.sin(obj.phase)*.32:0;obj.left.rotation.x=swing;obj.right.rotation.x=-swing;
  if(walking&&active){obj.stepTimer-=dt;const dist=obj.group.position.distanceTo(camera.position);if(obj.stepTimer<=0){obj.stepTimer=obj.slow?.68:.53;if(dist<9)sound('step',Math.max(.10,.32-dist*.022));}}
 }
 const followed=(!local.alive&&spectatorId)?remotes.get(spectatorId):null;
 const spectatorPose=spectatorCameraPose(followed);
 if(spectatorPose){
  camera.position.set(spectatorPose.x,spectatorPose.y,spectatorPose.z);
  camera.rotation.y=spectatorPose.yaw;camera.rotation.x=spectatorPose.pitch;
 }else{
  camera.position.set(local.x,(crouch?1.11:1.69)+local.jumpY+(local.alive?Math.sin(local.walk)*.022:0),local.z);
  camera.rotation.y=local.yaw;camera.rotation.x=local.pitch;
 }
 weaponRoot.visible=!!local.alive;
 sendAccumulator+=dt;if(sendAccumulator>.055&&active&&local.alive&&locked){sendAccumulator=0;send({t:'move',x:local.x,z:local.z,yaw:local.yaw,pitch:local.pitch,crouch:local.crouch,slow:walk});}
 updateHud();
}
function loop(t){requestAnimationFrame(loop);const dt=Math.min(.045,(t-last)/1000);last=t;elapsed+=dt;fpsAccum+=dt;
 if(t-lastPing>2000&&room&&ws?.readyState===WebSocket.OPEN){lastPing=t;send({t:'ping',stamp:t});}
 update(dt);
 if(room?.state==='playing'&&t-lastMini>120){lastMini=t;drawMiniMap();}
 const playing=room?.state==='playing',fpsCap=Number(settings.fpsCap);
 // Pausa, menus e separador sem pointer lock não precisam de renderização a 60 FPS.
 const interval=playing&&locked?(fpsCap===0?0:1000/fpsCap):playing?150:250;
 if(t-lastRender>=Math.max(0,interval-1)){
  lastRender=t;renderer.render(scene,camera);frameCount++;
 }
 if(fpsAccum>1){$('fps').textContent=`${Math.round(frameCount/fpsAccum)} FPS`;fpsAccum=0;frameCount=0;}
}
// SFX em volume reduzido. Sem ficheiros pesados nem loops de áudio.
let audio=null,footstepBuffer=null;function initAudio(){if(audio)return;try{audio=new (window.AudioContext||window.webkitAudioContext)();
 const sr=audio.sampleRate,frames=Math.floor(sr*.065);footstepBuffer=audio.createBuffer(1,frames,sr);
 const data=footstepBuffer.getChannelData(0);let previous=0;for(let i=0;i<frames;i++){previous=previous*.75+(Math.random()*2-1)*.25;data[i]=previous*(1-i/frames);}
 }catch{audio=null;}}
function sound(type,scale=1){if(settings.volume<=0||type==='step'&&settings.footsteps<=0)return;initAudio();if(!audio)return;
 if(audio.state==='suspended')audio.resume().catch(()=>{});
 const now=audio.currentTime;const gain=audio.createGain();gain.connect(audio.destination);
 const volume=settings.volume/100*(type==='step'?settings.footsteps/100:1);
 const dur=type==='step'?.038:type==='hit'?.095:type==='reload'?.09:.11;
 gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime((type==='step'?.090:type==='rifle'?.22:.12)*volume*scale,now+.004);
 gain.gain.exponentialRampToValueAtTime(.001,now+dur);
 if(type==='step'&&footstepBuffer){const src=audio.createBufferSource();src.buffer=footstepBuffer;
  const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=460;src.connect(filter);filter.connect(gain);src.start(now);src.stop(now+dur);return;}
 const osc=audio.createOscillator();osc.type=type==='hit'?'triangle':'sawtooth';
 osc.frequency.setValueAtTime(type==='step'?100:type==='rifle'?74:type==='pistol'?115:type==='hit'?620:210,now);
 osc.frequency.exponentialRampToValueAtTime(type==='step'?65:type==='hit'?810:45,now+dur);
 osc.connect(gain);osc.start(now);osc.stop(now+dur+.01);
}
function positionalShot(distance){if(distance<18)sound('pistol',Math.min(.3,3/(distance+2)))}
function loadSettings(){for(const id of ['sens','volume','footsteps','resolution','fpsCap','fov']){$(id).value=settings[id];$(id+'Value').textContent=id==='fpsCap'?(Number(settings[id])?settings[id]+' FPS':'SEM LIMITE'):settings[id]+(id==='sens'?'':id==='fov'?'°':'%');}}
function saveSettings(){for(const id of ['sens','volume','footsteps','resolution','fpsCap','fov'])settings[id]=Number($(id).value);
 camera.fov=settings.fov;camera.updateProjectionMatrix();
 localStorage.setItem('fw-settings',JSON.stringify(settings));renderer.setPixelRatio(renderPixelRatio());}
let lastSettingsCaller='menu';function openSettings(caller){lastSettingsCaller=caller;loadSettings();show(el.settings,true)}
function closeSettings(){saveSettings();show(el.settings,false);}
function pointers(){locked=document.pointerLockElement===renderer.domElement;if(!locked)isFiring=false;
 if(room?.state==='playing')show(el.pause,!locked);
 el.crosshair.style.display=locked&&local.alive?'block':'none';
}
function lockGame(){initAudio();renderer.domElement.requestPointerLock().catch(()=>msg('Clica novamente em VOLTAR AO JOGO'));}
function quitRoom(){
 isFiring=false;active=false;spectatorId=null;show($('spectatorInfo'),false);clearSession();send({t:'leave'});room=null;
 for(const obj of remotes.values())scene.remove(obj.group);remotes.clear();
 if(document.pointerLockElement===renderer.domElement)document.exitPointerLock();
 show(el.lobby,false);show(el.pause,false);show(el.menu,true);show(el.hud,false);
 show($('scoreboard'),false);el.crosshair.style.display='none';
 history.replaceState(null,'',location.pathname);
}
function bind(){
 $('createBtn').onclick=()=>{initAudio();resumePending=false;clearSession();send({t:'create',name:$('playerName').value,mode:$('modeSelect').value,map:$('mapSelect').value});};
 $('joinBtn').onclick=()=>{initAudio();resumePending=false;clearSession();send({t:'join',code:$('roomCodeInput').value,name:$('playerName').value});};
 $('roomCodeInput').onkeydown=e=>{if(e.key==='Enter')$('joinBtn').click()};
 $('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`);msg('Link da sala copiado!')}catch{msg('Código: '+room.code)}};
 $('hostMode').onchange=()=>send({t:'config',mode:$('hostMode').value,map:$('hostMap').value});
 $('hostMap').onchange=()=>send({t:'config',mode:$('hostMode').value,map:$('hostMap').value});
 $('startMatch').onclick=()=>send({t:'start'});
 $('lobbyPlayers').addEventListener('click',e=>{const button=e.target.closest('button[data-player]');if(button)send({t:'team',id:button.dataset.player});});
 $('leaveRoom').onclick=quitRoom;
 $('resume').onclick=()=>{if(room?.state==='matchover'){send({t:'start'});return;}lockGame();};
 $('pauseLeave').onclick=quitRoom;
 $('settingsOpen').onclick=()=>openSettings('menu');$('pauseSettings').onclick=()=>openSettings('pause');$('closeSettings').onclick=closeSettings;
 for(const id of ['sens','volume','footsteps','resolution','fpsCap','fov'])$(id).oninput=()=>$(id+'Value').textContent=id==='fpsCap'?(Number($(id).value)?$(id).value+' FPS':'SEM LIMITE'):$(id).value+(id==='sens'?'':id==='fov'?'°':'%');
 document.addEventListener('pointerlockchange',pointers);
 document.addEventListener('mousemove',e=>{if(!locked||!active||!local.alive)return;
  const factor=Number(settings.sens)*.00031;local.yaw-=e.movementX*factor;local.pitch=Math.max(-1.26,Math.min(1.26,local.pitch-e.movementY*factor));});
 document.addEventListener('mousedown',e=>{if(locked&&e.button===0)isFiring=true;});
 document.addEventListener('mouseup',e=>{if(e.button===0)isFiring=false;});
 document.addEventListener('contextmenu',e=>{if(locked)e.preventDefault()});
 document.addEventListener('keydown',e=>{
  if(document.activeElement?.matches('input,select'))return;
  if(['Space','Tab','ControlLeft','ControlRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys[e.code]=true;
  if(e.code==='Tab'&&room)show($('scoreboard'),true);
  if(e.repeat)return;
  if(locked&&active&&!local.alive&&(e.code==='KeyQ'||e.code==='KeyE')){pickSpectator(e.code==='KeyE'?1:-1);return;}
  if(locked&&active&&local.alive){if(e.code==='Digit1')equip('rifle');if(e.code==='Digit2')equip('pistol');if(e.code==='Digit3')equip('knife');
   if(e.code==='KeyR')reload();if(e.code==='KeyF')local.inspect=1.35;}
 });
 document.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Tab')show($('scoreboard'),false);});
 window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;isFiring=false;show($('scoreboard'),false)});
 // Refresh mantém a sessão 12 segundos; sair pelos botões elimina-a explicitamente.
}
setup3D();buildWorld(MAPS.dockyard);bind();connect();requestAnimationFrame(loop);$('createBtn').disabled=true;$('joinBtn').disabled=true;
