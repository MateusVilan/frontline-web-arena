import assert from 'node:assert/strict';
const port=Number(process.env.TEST_PORT||3000);
const clients=[];
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function connect(){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true})});clients.push(ws);return ws;}
function next(ws,type,timeout=3000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.removeEventListener('message',listener);reject(Error('Timeout '+type));},timeout);function listener(e){const m=JSON.parse(e.data);if(m.type===type){clearTimeout(timer);ws.removeEventListener('message',listener);resolve(m);}}ws.addEventListener('message',listener);});}
try{
 const host=await connect();let promise=next(host,'ROOM');host.send(JSON.stringify({type:'CREATE',map:'rust',name:'Mateus'}));const created=await promise;
 const guest=await connect();promise=next(guest,'ROOM');guest.send(JSON.stringify({type:'JOIN',code:created.code,name:'  Amigo <99>  '}));const joined=await promise;
 assert.equal(joined.team,'orange');
 let snapshot=await next(host,'STATE');
 assert.deepEqual(new Set(snapshot.players.map(p=>p.name)), new Set(['Mateus','Amigo 99']));
 const initial=snapshot.players.find(p=>p.id===created.id);
 // Request a 7 meter teleport within one network packet: rejected.
 host.send(JSON.stringify({type:'MOVE',x:initial.x+7,z:initial.z,yaw:0,pitch:0,weapon:'m4',moving:true}));
 await wait(125);snapshot=await next(host,'STATE');
 const updated=snapshot.players.find(p=>p.id===created.id);
 assert.equal(updated.x,initial.x,'server rejected implausible teleport');
 console.log('PASS: two named multiplayer clients, snapshot names, rejected teleport');
}finally{for(const w of clients)w.close();}
