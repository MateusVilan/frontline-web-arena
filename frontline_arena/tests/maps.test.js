import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,MODES,canStand,WEAPONS,sweepMove,moveSpeed} from '../public/maps.js';
for(const map of Object.values(MAPS)){
 test(`${map.name}: grid consistente e spawns válidos`,()=>{
  assert.equal(map.grid.length,map.height);
  for(const row of map.grid)assert.equal(row.length,map.width);
  for(const team of ['A','B'])for(const [x,z] of map.spawns[team])assert.equal(canStand(map,x,z),true);
 });
 test(`${map.name}: caminho entre equipas`,()=>{
  const [x,z]=map.spawns.A[0],goal=map.spawns.B[0];const q=[[Math.floor(x),Math.floor(z)]];const seen=new Set(q.map(p=>p.join(',')));
  let connected=false;for(let i=0;i<q.length;i++){
   const [a,b]=q[i];if(a===Math.floor(goal[0])&&b===Math.floor(goal[1])){connected=true;break;}
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=a+dx,nz=b+dz,key=`${nx},${nz}`;
    if(!seen.has(key)&&canStand(map,nx+.5,nz+.5)){seen.add(key);q.push([nx,nz]);}
   }
  }
  assert.equal(connected,true);
 });
}
test('Modo 1v1, 2v1 e 2v2 preenchem salas sem exceder 4 jogadores',()=>{
 for(const mode of Object.values(MODES)){assert.equal(mode.teamA+mode.teamB,mode.max);assert.ok(mode.max>=2&&mode.max<=4)}
});
test('Equipamento tem características válidas',()=>{
 for(const weapon of Object.values(WEAPONS)){assert.ok(weapon.speed>0&&weapon.cooldown>0&&weapon.damage>0)}
});
test('Movimento com subpassos não atravessa uma parede ou caixa',()=>{
 for(const map of Object.values(MAPS)){
  const target=map.grid.flatMap((row,z)=>[...row].map((tile,x)=>tile==='c'?{x,z}:null)).find(Boolean);
  assert.ok(target);
  const start={x:target.x-1.5,z:target.z+.5};
  if(!canStand(map,start.x,start.z))continue;
  const moved=sweepMove(map,start.x,start.z,4,0);
  assert.ok(moved.x<target.x-.20,`${map.name}: ${moved.x} atravessou a caixa em x=${target.x}`);
  assert.equal(canStand(map,moved.x,moved.z),true);
 }
});
test('Velocidade de faca é maior; andar lento/agachado reduz a velocidade',()=>{
 assert.ok(moveSpeed('knife')>moveSpeed('pistol'));
 assert.ok(moveSpeed('pistol')>moveSpeed('rifle'));
 assert.ok(moveSpeed('rifle',true)<moveSpeed('rifle'));
 assert.ok(moveSpeed('rifle',false,true)<moveSpeed('rifle'));
});
test('Subpassos em terreno livre preservam o comprimento e movimento diagonal',()=>{
 const map=MAPS.dockyard,from={x:3.5,z:10.5},dx=1.1,dz=-1.1;
 assert.ok(canStand(map,from.x+dx,from.z+dz));
 const moved=sweepMove(map,from.x,from.z,dx,dz);
 assert.ok(Math.abs(moved.x-(from.x+dx))<1e-8);
 assert.ok(Math.abs(moved.z-(from.z+dz))<1e-8);
});
