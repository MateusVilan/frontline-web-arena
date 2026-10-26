import assert from 'node:assert/strict';

const port=Number(process.env.TEST_PORT||3000);
const address=`ws://127.0.0.1:${port}/ws`;
const clients=[];
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function connect(){
 const ws=new WebSocket(address);
 await new Promise((ok,fail)=>{
  const timer=setTimeout(()=>fail(Error('WebSocket handshake timeout')),3500);
  ws.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});
  ws.addEventListener('error',e=>{clearTimeout(timer);fail(e);},{once:true});
 });
 clients.push(ws);
 return ws;
}
function next(ws,type,timeout=3500){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.removeEventListener('message',handler);reject(Error('Timed out: '+type));},timeout);
 const handler=(e)=>{const packet=JSON.parse(e.data);if(packet.type!==type)return;clearTimeout(timer);ws.removeEventListener('message',handler);resolve(packet);};
 ws.addEventListener('message',handler);
});}
const message=(ws,data)=>ws.send(JSON.stringify(data));

try{
 const host=await connect();
 let pending=next(host,'ROOM');message(host,{type:'CREATE',map:'rust',name:'HOST'});
 const a=await pending;
 assert.match(a.session,/^[0-9a-f]{48}$/);
 const guest=await connect();
 pending=next(guest,'ROOM');message(guest,{type:'JOIN',code:a.code,name:'ALICE'});
 const b=await pending;
 assert.equal(b.team,'orange');
 const priorId=b.id;
 guest.close();
 await wait(120);
 let snap=await next(host,'STATE');
 const missing=snap.players.find(p=>p.id===priorId);
 assert.ok(missing,'disconnected player kept in room');
 assert.equal(missing.online,false,'player marked offline during grace');
 // Stolen or invalid tokens cannot recover someone's reserved slot.
 const thief=await connect();
 pending=next(thief,'ERROR');message(thief,{type:'RESUME',code:a.code,session:'fake'});
 assert.match((await pending).message,/reconexão/i);
 const restored=await connect();
 pending=next(restored,'RESUMED');message(restored,{type:'RESUME',code:a.code,session:b.session});
 const recovered=await pending;
 assert.equal(recovered.id,priorId,'same identity after reconnect');
 assert.equal(recovered.host,false,'team/host preserved');
 assert.equal(recovered.team,'orange','team preserved');
 snap=await next(host,'STATE');
 assert.equal(snap.players.find(p=>p.id===priorId).online,true);
 // Resume token cannot be replayed while its owner is connected.
 const second=await connect();
 pending=next(second,'ERROR');message(second,{type:'RESUME',code:a.code,session:b.session});
 assert.match((await pending).message,/reconexão/i);
 // Explicit leave frees the slot instead of retaining a ghost player.
 pending=next(host,'STATE');message(restored,{type:'LEAVE'});
 let after=await pending;
 if(after.players.some(p=>p.id===priorId))after=await next(host,'STATE');
 assert.equal(after.players.some(p=>p.id===priorId),false);
 console.log('PASS: temporary offline status, secure resume, same ID/team/host, replay protection, explicit leave');
}finally{for(const client of clients)client.close();}
