/** Espectador só recebe alvos vivos da sua própria equipa. */
export function spectatorCandidates(room, team, myID, remoteIds) {
 if (!room?.players) return [];
 const available=new Set(remoteIds);
 return room.players.filter(p => p.id!==myID && p.team===team && p.alive && p.connected && available.has(p.id));
}
/** Próximo colega, com retorno circular para 2v2. */
export function nextSpectatorId(candidates, current, direction=0){
 if (!candidates.length) return null;
 const at=candidates.findIndex(p=>p.id===current);
 if (!direction && at>=0)return current;
 if (!direction)return candidates[0].id;
 return candidates[(at+direction+candidates.length)%candidates.length].id;
}

/** Usa a posição INTERPOLADA do avatar remoto; nunca posições não validadas pelo servidor. */
export function spectatorCameraPose(remote){
 if(!remote?.alive||!remote.group?.position)return null;
 const {x,z}=remote.group.position;
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 const yaw=Number(remote.group.rotation?.y),pitch=Number(remote.pitch);
 return {x,z,y:remote.crouch?1.11:1.69,
  yaw:Number.isFinite(yaw)?yaw:0,
  pitch:Number.isFinite(pitch)?Math.max(-1.26,Math.min(1.26,pitch)):0};
}
