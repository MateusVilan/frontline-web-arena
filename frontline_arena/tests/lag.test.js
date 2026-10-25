import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../public/maps.js';
import {traceHit} from '../public/combat.js';
import {MAX_REWIND_MS,rememberPosition,historicalPosition,rewindAt} from '../public/lag.js';

test('O histórico interpola posições aceites pelo servidor',()=>{
 const p={x:3,z:10,crouch:false};
 rememberPosition(p,1000);
 p.x=7;p.crouch=true;rememberPosition(p,1100);
 assert.equal(historicalPosition(p,1050).x,5);
 assert.equal(historicalPosition(p,1050).crouch,false);
 assert.equal(historicalPosition(p,1100).crouch,true);
 assert.equal(historicalPosition(p,900).x,3);
 assert.equal(historicalPosition(p,1200).x,7);
});
test('O histórico ignora pacotes temporais fora de ordem',()=>{
 const p={x:4,z:4,crouch:false};rememberPosition(p,1000);
 p.x=11;rememberPosition(p,950);
 assert.equal(historicalPosition(p,2000).x,4);
});
test('O servidor limita a compensação de lag para evitar abusos',()=>{
 assert.equal(rewindAt(2000,60),1970);
 assert.equal(rewindAt(2000,5000),2000-MAX_REWIND_MS);
 assert.equal(rewindAt(2000,-50),2000);
 assert.equal(rewindAt(2000,NaN),2000);
});
test('Um alvo em movimento pode ser acertado na posição validada de há 50 ms',()=>{
 const shooter={id:'a',team:'A',x:3.5,z:10.5,crouch:false,alive:true};
 const target={id:'b',team:'B',x:6.0,z:10.5,crouch:false,alive:true};
 rememberPosition(target,1000);target.x=6;target.z=11.5;rememberPosition(target,1100);
 const old=historicalPosition(target,1000);
 assert.ok(traceHit(MAPS.dockyard,[shooter,{...target,...old}],shooter,-Math.PI/2,0,10));
 assert.equal(traceHit(MAPS.dockyard,[shooter,target],shooter,-Math.PI/2,0,10),null);
});
test('O histórico limita a memória ao intervalo necessário',()=>{
 const p={x:3,z:10,crouch:false};
 for(let i=0;i<120;i++){p.x+=.001;rememberPosition(p,1000+i*30);}
 assert.ok(p.history.length<25,`Foram guardadas ${p.history.length} posições`);
});
