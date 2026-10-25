import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir=new URL('../public/',import.meta.url);
test('Elementos da interface usados pelo jogo existem no HTML',()=>{
 const html=fs.readFileSync(new URL('index.html',dir),'utf8');
 const script=fs.readFileSync(new URL('game.js',dir),'utf8');
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const used=[...script.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 const missing=[...new Set(used)].filter(id=>!ids.has(id));
 assert.deepEqual(missing,[]);
});
test('Imports locais apontam para ficheiros existentes',()=>{
 const script=fs.readFileSync(new URL('game.js',dir),'utf8');
 for(const m of script.matchAll(/from '\.\/([^']+)'/g)){
  assert.ok(fs.existsSync(new URL(m[1],dir)),`Ficheiro em falta: ${m[1]}`);
 }
});
test('O modo espectador atualiza a câmara e oculta arma enquanto se observa um colega',()=>{
 const script=fs.readFileSync(new URL('game.js',dir),'utf8');
 assert.match(script,/spectatorCameraPose\(followed\)/);
 assert.match(script,/weaponRoot\.visible=!!local\.alive/);
 assert.match(script,/A ESPECTAR/);
});
