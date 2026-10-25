import test from 'node:test';
import assert from 'node:assert/strict';
import {spectatorCandidates,nextSpectatorId} from '../public/spectator.js';
const players=[
 {id:'self',team:'A',alive:false,connected:true},
 {id:'mate',team:'A',alive:true,connected:true},
 {id:'mate2',team:'A',alive:true,connected:true},
 {id:'dead',team:'A',alive:false,connected:true},
 {id:'offline',team:'A',alive:true,connected:false},
 {id:'enemy',team:'B',alive:true,connected:true}
];
test('Espectador segue apenas colegas vivos e ligados, nunca inimigos',()=>{
 const eligible=spectatorCandidates({players},'A','self',players.map(p=>p.id));
 assert.deepEqual(eligible.map(p=>p.id),['mate','mate2']);
});
test('Sem uma personagem remota disponível, não permite espectar',()=>{
 assert.deepEqual(spectatorCandidates({players},'A','self',[]),[]);
 assert.equal(nextSpectatorId([],null,1),null);
});
test('Teclas Q e E alternam entre colegas e dão a volta ao fim',()=>{
 const group=spectatorCandidates({players},'A','self',players.map(p=>p.id));
 assert.equal(nextSpectatorId(group,null),'mate');
 assert.equal(nextSpectatorId(group,'mate',1),'mate2');
 assert.equal(nextSpectatorId(group,'mate2',1),'mate');
 assert.equal(nextSpectatorId(group,'mate',-1),'mate2');
});
test('Espectador reajusta automaticamente quando o colega morre',()=>{
 const group=spectatorCandidates({players:players.filter(p=>p.id!=='mate')},'A','self',players.map(p=>p.id));
 assert.equal(nextSpectatorId(group,'mate'), 'mate2');
});

test('Câmara acompanha a posição interpolada do colega e a sua orientação', async()=>{
 const {spectatorCameraPose}=await import('../public/spectator.js');
 const remote={alive:true,crouch:false,pitch:.3,group:{position:{x:8.25,z:13.4},rotation:{y:-1.2}}};
 assert.deepEqual(spectatorCameraPose(remote),{x:8.25,z:13.4,y:1.69,yaw:-1.2,pitch:.3});
 remote.crouch=true;remote.pitch=10;
 assert.equal(spectatorCameraPose(remote).y,1.11);
 assert.equal(spectatorCameraPose(remote).pitch,1.26);
 remote.alive=false;assert.equal(spectatorCameraPose(remote),null);
});

test('Uma câmara sem avatar remoto válido não expõe uma posição',async()=>{
 const {spectatorCameraPose}=await import('../public/spectator.js');
 assert.equal(spectatorCameraPose(null),null);
 assert.equal(spectatorCameraPose({alive:true,group:{position:{x:NaN,z:0}}}),null);
});
