import assert from 'node:assert/strict';
import http from 'node:http';
const port=Number(process.env.TEST_PORT||3000);
function request(path,method='GET'){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path,method},res=>{
   let data='';res.setEncoding('utf8');res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,data,headers:res.headers}));
  });req.on('error',reject);req.end();
 });
}
const regular=await request('/src/main.js');assert.equal(regular.status,200);
assert.match(regular.headers['content-type'],/javascript/);
assert.equal(regular.headers['x-content-type-options'],'nosniff');
const home=await request('/');assert.equal(home.status,200);assert.match(home.data,/FRONTLINE/);
const stat=await request('/src/style.css','HEAD');assert.equal(stat.status,200);assert.equal(stat.data,'');
const denied=[
 '/public/%2e%2e%2fserver%2findex.js',
 '/src/%2e%2e%2fpackage.json',
 '/shared/%2e%2e%2ftools%2ftest-server.mjs',
 '/public/%2e%2e%5cserver%5cindex.js',
];
for(const path of denied){const r=await request(path);assert.notEqual(r.status,200,path);assert.doesNotMatch(r.data,/import http from ['"]node:http/);}
const post=await request('/src/main.js','POST');assert.equal(post.status,405);
const missing=await request('/server/index.js');assert.equal(missing.status,404);
console.log('PASS: public assets, HEAD, private server file access denied, traversal paths denied, POST blocked');
