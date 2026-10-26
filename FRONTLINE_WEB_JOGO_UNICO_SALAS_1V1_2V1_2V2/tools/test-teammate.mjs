import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {createTeammate,createEnemy,animateEnemy} from '../src/models.js';
for(const weapon of ['m4','pistol','ak','mp9','knife']){
 const ally=createTeammate(T,weapon),enemy=createEnemy(T,weapon);
 assert.equal(ally.userData.teammate,true);
 assert.equal(enemy.userData.teammate,undefined);
 assert.equal(ally.userData.weaponId,weapon);
 assert.equal(ally.userData.arms.length,2);
 assert.equal(ally.userData.legs.length,2);
 const allyColors=new Set(),enemyColors=new Set();
 ally.traverse(n=>{if(n.material?.color)allyColors.add(n.material.color.getHex());});
 enemy.traverse(n=>{if(n.material?.color)enemyColors.add(n.material.color.getHex());});
 assert.ok(allyColors.has(0x3ce0e9),'cyan ally patches');
 assert.ok(!enemyColors.has(0x3ce0e9),'bots are not cyan');
 assert.ok(ally.children.length!==enemy.children.length,'distinct silhouettes');
 const shoulder=ally.userData.rifle.position.clone(),grip=ally.userData.gun.userData.gripSockets.right.clone();
 ally.updateMatrixWorld(true);
 const heldGrip=ally.userData.gun.localToWorld(grip).clone(),mount=ally.userData.rifle.getWorldPosition(new T.Vector3());
 assert.ok(heldGrip.distanceTo(mount)<1e-5,'weapon held by right hand socket');
 animateEnemy(ally,true,.016);
 assert.ok(Number.isFinite(ally.userData.rifle.position.y));
 console.log('PASS teammate:',weapon,'unique silhouette and blue/cyan uniform, grip anchored');
}
