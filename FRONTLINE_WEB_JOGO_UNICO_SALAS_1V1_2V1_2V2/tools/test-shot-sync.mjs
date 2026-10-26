import assert from 'node:assert/strict';
const PORT=process.env.TEST_PORT||'3000';
const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
const inbox=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
ws.addEventListener('message',event=>inbox.push(JSON.parse(event.data)));
const send=data=>ws.send(JSON.stringify(data));
async function waitFor(type,predicate=()=>true,timeout=2500){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){const index=inbox.findIndex(m=>m.type===type&&predicate(m));if(index>=0)return inbox.splice(index,1)[0];await sleep(8);}
 throw Error(`Não chegou a mensagem ${type} no tempo esperado`);
}
try {
 await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
 send({type:'CREATE',map:'rust',name:'TESTADOR'});
 await waitFor('ROOM');
 send({type:'SHOT',seq:1,weapon:'m4',yaw:0,pitch:0});
 send({type:'SHOT',seq:2,weapon:'m4',yaw:0,pitch:0});
 const a=await waitFor('SHOT_RESULT',m=>m.seq===1);
 const b=await waitFor('SHOT_RESULT',m=>m.seq===2);
 assert.equal(a.accepted,true);
 assert.equal(a.remaining,29);
 assert.equal(b.accepted,false,'tiro demasiado rápido recusado');
 assert.equal(b.remaining,29,'o carregador não perde bala no tiro recusado');
 send({type:'SHOT',seq:3,weapon:'pistol',yaw:0,pitch:0});
 const wrong=await waitFor('SHOT_RESULT',m=>m.seq===3);
 assert.equal(wrong.accepted,false,'arma ainda não equipada');
 assert.equal(wrong.remaining,13);
 send({type:'RELOAD',weapon:'m4'});
 const start=await waitFor('AMMO_SYNC',m=>m.reloading==='m4');
 assert.equal(start.ammo.m4,29);
 assert.ok(start.reloadRemaining>0,'recarga comunicada logo ao cliente');
 send({type:'SHOT',seq:4,weapon:'m4',yaw:0,pitch:0});
 const during=await waitFor('SHOT_RESULT',m=>m.seq===4);
 assert.equal(during.accepted,false);
 assert.equal(during.remaining,29);
 await sleep(1680);
 const ended=await waitFor('AMMO_SYNC',m=>!m.reloading&&m.ammo.m4===30);
 assert.equal(ended.ammo.m4,30);
 send({type:'RELOAD',weapon:'m4'});
 const refused=await waitFor('AMMO_SYNC',m=>!m.reloading&&m.ammo.m4===30);
 assert.equal(refused.ammo.m4,30,'recarga desnecessária corrigida no HUD');
 console.log('PASS: confirmação por disparo, cadência, arma inválida, sincronização de recarga e carregador');
}finally{ws.close();}
