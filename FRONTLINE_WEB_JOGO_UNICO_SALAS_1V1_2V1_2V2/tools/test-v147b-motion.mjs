import assert from 'node:assert/strict';
import {butterflyMotion} from '../src/butterfly-motion.js';
const closed=butterflyMotion(0,0),ready=butterflyMotion(0,1);
assert.ok(Math.abs(closed.handleAX)>3 && Math.abs(closed.handleBX)>3,'closed handles rotate almost 180 degrees');
assert.ok(Math.abs(ready.handleAX)<.01&&Math.abs(ready.handleBX)<.01,'knife fully opens');
for(const t of [0,.05,.12,.25,.38,.5,.65,.8,.98,1]){
 const s=butterflyMotion(t,1);
 for(const [key,v] of Object.entries(s))assert.ok(Number.isFinite(v),key);
}
assert.notEqual(butterflyMotion(.22,1).handleAX,butterflyMotion(.56,1).handleAX,'inspect uses distinct tricks');
const samples=[...Array(61)].map((_,i)=>butterflyMotion(0,i/60));
for(let i=1;i<samples.length;i++)assert.ok(Math.abs(samples[i].handleAX-samples[i-1].handleAX)<.10,'smooth opening');
console.log('PASS butterfly: genuine X-axis open/close, inspect flips, smooth equip');
