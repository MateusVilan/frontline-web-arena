import assert from 'node:assert/strict';
const port=Number(process.env.TEST_PORT||3000);
const clients=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const connect=async()=>{
 const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);
 await new Promise((done,fail)=>{ws.addEventListener('open',done,{once:true});ws.addEventListener('error',fail,{once:true});});
 clients.push(ws);return ws;
};
const next=(ws,type,timeout=34000,predicate=()=>true)=>new Promise((resolve,reject)=>{
 const t=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error('Timeout '+type));},timeout);
 function onMessage(e){const p=JSON.parse(e.data);if(p.type===type&&predicate(p)){clearTimeout(t);ws.removeEventListener('message',onMessage);resolve(p);}}
 ws.addEventListener('message',onMessage);
});
try{
 const host=await connect();let pending=next(host,'ROOM');host.send(JSON.stringify({type:'CREATE',map:'rust'}));const a=await pending;
 const guest=await connect();pending=next(guest,'ROOM');guest.send(JSON.stringify({type:'JOIN',code:a.code}));const b=await pending;
 assert.equal(b.host,false);
 pending=next(guest,'HOST');const stateAfterExpiry=next(guest,'STATE',34000,s=>s.players.length===1);host.close();await pending;
 const state=await stateAfterExpiry;assert.equal(state.players.length,1,'offline slot purged after timeout');
 const late=await connect();pending=next(late,'ERROR');late.send(JSON.stringify({type:'RESUME',code:a.code,session:a.session}));
 assert.match((await pending).message,/reconexão/i);
 console.log('PASS: disconnected host expires, next online player promoted, expired token rejected');
}finally{for(const client of clients)client.close();}
