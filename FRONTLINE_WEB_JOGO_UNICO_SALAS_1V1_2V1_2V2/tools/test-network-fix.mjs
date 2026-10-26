import assert from 'node:assert/strict';
const port=Number(process.env.TEST_PORT||3000),url=`ws://127.0.0.1:${port}/ws`;
const clients=[];
const connect=async()=>{
 const ws=new WebSocket(url);
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('handshake timeout')),4000);ws.addEventListener('open',()=>{clearTimeout(timeout);resolve();},{once:true});ws.addEventListener('error',e=>{clearTimeout(timeout);reject(e);},{once:true});});
 clients.push(ws);return ws;
};
const send=(ws,data)=>ws.send(JSON.stringify(data));
function next(ws,type,timeout=3000){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.removeEventListener('message',handler);reject(Error('timeout waiting for '+type));},timeout);
 const handler=e=>{const v=JSON.parse(e.data);if(v.type!==type)return;clearTimeout(timer);ws.removeEventListener('message',handler);resolve(v);};
 ws.addEventListener('message',handler);
});}
try{
 const original=await connect();
 let pending=next(original,'ROOM');send(original,{type:'CREATE',map:'rust',name:'Mateus'});
 const room=await pending;
 assert.match(room.session,/^[0-9a-f]{48}$/);
 // A rejected teleport MUST push an authoritative correction to the client.
 pending=next(original,'MOVE_CORRECTION');
 send(original,{type:'MOVE',x:999,z:999,yaw:0,pitch:0,weapon:'m4'});
 const fix=await pending;
 assert.ok(Number.isFinite(fix.x)&&Number.isFinite(fix.z));
 assert.ok(fix.x<100&&fix.z<100,'server did not accept teleported position');
 // Refresh race: old browser connection is still alive when new tab asks to resume.
 const replacement=await connect();
 pending=next(replacement,'RESUMED');send(replacement,{type:'RESUME',code:room.code,session:room.session});
 const resumed=await pending;
 assert.equal(resumed.id,room.id,'same slot survives refresh race');
 assert.equal(resumed.host,true);
 assert.match(resumed.session,/^[0-9a-f]{48}$/);
 assert.notEqual(resumed.session,room.session,'recovery rotates the secret');
 const thief=await connect();pending=next(thief,'ERROR');send(thief,{type:'RESUME',code:room.code,session:room.session});
 assert.match((await pending).message,/reconexão/i);
 const third=await connect();pending=next(third,'RESUMED');send(third,{type:'RESUME',code:room.code,session:resumed.session});
 const resumedAgain=await pending;
 assert.equal(resumedAgain.id,room.id);assert.notEqual(resumedAgain.session,resumed.session);
 // Repeating RESUME from one's already-authenticated socket must not remove the player.
 pending=next(third,'RESUMED');send(third,{type:'RESUME',code:room.code,session:resumedAgain.session});
 const selfResume=await pending;assert.equal(selfResume.id,room.id);
 const state=await next(third,'STATE');assert.ok(state.players.some(p=>p.id===room.id));
 console.log('PASS: invalid movement correction, refresh takeover, stable identity and one-time token rotation');
} finally {for(const ws of clients)try{ws.close();}catch{}}
