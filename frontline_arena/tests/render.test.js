import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelRatio} from '../public/render.js';
test('Reduz resolução num monitor DPR 1 (antes o controlo não funcionava)',()=>{
 assert.equal(pixelRatio(1,100),1);
 assert.equal(pixelRatio(1,80),.8);
 assert.equal(pixelRatio(1,50),.5);
});
test('Mantém escalas úteis em ecrãs retina',()=>{
 assert.equal(pixelRatio(2,80),1.6);
 assert.equal(pixelRatio(2,100),2);
 assert.equal(pixelRatio(3,100),2);
});
test('Escala malformada não causa renderização inválida',()=>{
 assert.equal(pixelRatio(NaN,NaN),.8);
 assert.equal(pixelRatio(-4,180),1);
});
