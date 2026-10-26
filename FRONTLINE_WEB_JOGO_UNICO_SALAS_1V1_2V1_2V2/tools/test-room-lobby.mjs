import assert from 'node:assert/strict';
const address=`ws://127.0.0.1:${Number(process.env.TEST_PORT||3000)}/ws`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clients=[];
async function conn(){
 const ws=new WebSocket(address),messages=[];
 ws.addEventListener('message',e=>{try{messages.push(JSON.parse(e.data));}catch{}});
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
 clients.push(ws);
 return {send:x=>ws.send(JSON.stringify(x)),async next(type,filter=()=>true){const end=Date.now()+3500;while(Date.now()<end){const i=messages.findIndex(m=>m.type===type&&filter(m));if(i>=0)return messages.splice(i,1)[0];await sleep(10);}throw Error(`Missing ${type}: ${JSON.stringify(messages.slice(-3))}`);}};
}
try{
 for(const mode of ['1v1','2v1','2v2']){
  const max={'1v1':2,'2v1':3,'2v2':4}[mode];
  const host=await conn();host.send({type:'CREATE',lobby:true,mode,map:'rust',name:'HOST'});
  const room=await host.next('ROOM');assert.equal(room.lobby,true);assert.equal(room.gameMode,mode);
  let lobby=await host.next('LOBBY');assert.equal(lobby.mode,mode);assert.equal(lobby.players.length,1);
  host.send({type:'LOBBY_START'});assert.match((await host.next('ERROR')).message,/Faltam jogadores/);
  host.send({type:'MOVE',x:100,z:100,weapon:'m4'});
  // While the lobby is open movement/attacks are ignored.
  const guests=[];
  for(let i=1;i<max;i++){
   const guest=await conn();guest.send({type:'JOIN',code:room.code,name:`GUEST${i}`});guests.push(guest);
   const joined=await guest.next('ROOM');assert.equal(joined.lobby,true);
   lobby=await host.next('LOBBY',m=>m.players.length===i+1);
  }
  assert.equal(lobby.players.filter(p=>p.team==='blue').length,mode==='1v1'?1:2);
  assert.equal(lobby.players.filter(p=>p.team==='orange').length,mode==='2v2'?2:1);
  const nonHost=guests[0];nonHost.send({type:'LOBBY_START'});
  // Host can change mode if the room fits; unauthorized guest cannot.
  nonHost.send({type:'LOBBY_CONFIG',mode:'2v2',map:'azure'});
  assert.match((await nonHost.next('ERROR')).message,/anfitrião/);
  if(mode==='1v1'){
   // Full teams must be swappable by the host.
   const other=lobby.players.find(p=>!p.host);
   host.send({type:'LOBBY_TEAM',id:other.id,team:'blue'});
   const swapped=await host.next('LOBBY',m=>m.players.find(p=>p.id===other.id)?.team==='blue');
   assert.equal(swapped.players.find(p=>p.host).team,'orange');
   assert.equal(swapped.players.filter(p=>p.team==='blue').length,1);
   assert.equal(swapped.players.filter(p=>p.team==='orange').length,1);
  }
  host.send({type:'LOBBY_CONFIG',map:'azure',mode});
  await host.next('LOBBY',m=>m.map==='azure');
  host.send({type:'LOBBY_START'});
  const started=await host.next('LOBBY_STARTED');assert.equal(started.map,'azure');
  const state=await host.next('STATE',m=>m.map==='azure'&&m.players.length===max);
  assert.equal(state.players.length,max);
  const extra=await conn();extra.send({type:'JOIN',code:room.code});assert.match((await extra.next('ERROR')).message,/Partida em curso/);
  for(const c of [host,...guests])c.send({type:'LEAVE'});
 }
 console.log('PASS: 1v1, 2v1, 2v2 pre-match lobby, host configuration, team swap, full rosters and gated starts.');
}finally{for(const ws of clients){try{ws.send(JSON.stringify({type:'LEAVE'}));ws.close();}catch{}}}
