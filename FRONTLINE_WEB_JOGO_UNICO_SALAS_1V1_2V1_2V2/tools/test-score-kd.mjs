import assert from 'node:assert/strict';
const url=`ws://127.0.0.1:${Number(process.env.TEST_PORT||3000)}/ws`;
const sockets=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function connect(){
 const socket=new WebSocket(url);const queue=[];
 socket.addEventListener('message',ev=>{try{queue.push(JSON.parse(ev.data));}catch{}});
 await new Promise((ok,bad)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',bad,{once:true});});
 sockets.push(socket);
 return {send:obj=>socket.send(JSON.stringify(obj)),async next(type,accept=()=>true,timeout=5000){const until=Date.now()+timeout;while(Date.now()<until){const i=queue.findIndex(m=>m.type===type&&accept(m));if(i>=0)return queue.splice(i,1)[0];await sleep(10);}throw new Error('Missing '+type);}};
}
try{
 const host=await connect();host.send({type:'CREATE',map:'rust',name:'LIDER'});const room=await host.next('ROOM');
 const guest=await connect();guest.send({type:'JOIN',code:room.code,name:'VISITANTE'});const other=await guest.next('ROOM');
 let state=await host.next('STATE',m=>m.players.length===2);
 assert.deepEqual(state.players.map(p=>p.deaths),[0,0]);
 // Reach a clear duel lane while respecting the anti-teleport movement limiter.
 for(let i=1;i<=21;i++){
   host.send({type:'MOVE',x:7.5,z:13.5+Math.min(i,9)/3,yaw:-Math.PI/2,pitch:0,weapon:'m4'});
   guest.send({type:'MOVE',x:29.5,z:23.5-i/3,yaw:Math.PI/2,pitch:0,weapon:'m4'});
   await sleep(60);
 }
 await sleep(750);
 for(let i=0;i<7;i++){host.send({type:'SHOT',weapon:'m4',yaw:-Math.PI/2,pitch:0,seq:i+1});await sleep(120);}
 const kill=await host.next('KILL');assert.equal(kill.killer,room.id);assert.equal(kill.victim,other.id);
 state=await host.next('STATE',m=>m.players.some(p=>p.id===other.id&&p.deaths===1));
 assert.equal(state.players.find(p=>p.id===room.id).kills,1);
 assert.equal(state.players.find(p=>p.id===other.id).deaths,1);
 // Restarting the same arena clears K and D for both players.
 host.send({type:'MAP',map:'rust'});await host.next('MAP',m=>m.reset);
 state=await host.next('STATE',m=>m.players.length===2&&m.players.every(p=>p.kills===0&&p.deaths===0));
 assert.equal(state.players.length,2);
 console.log('PASS: authoritative multiplayer kills/deaths and same-map reset.');
} finally{for(const s of sockets)s.close();}
