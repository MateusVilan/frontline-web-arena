import {MODES} from './maps.js';
/** Limites das equipas são uma regra do servidor, inclusive durante a preparação. */
export function teamCounts(room){const count={A:0,B:0};for(const p of room.players.values())if(p.team in count)count[p.team]++;return count;}
export function teamsReady(room){const mode=MODES[room.mode];if(!mode)return false;
 const c=teamCounts(room);return c.A===mode.teamA&&c.B===mode.teamB;
}
/** Reinicialização quando o host altera o modo de jogo. */
export function distributeTeams(room){const mode=MODES[room.mode];if(!mode)return;
 [...room.players.values()].forEach((p,i)=>p.team=i<mode.teamA?'A':'B');
}
/** Preenche vagas da equipa A e depois da equipa B ao entrar. */
export function teamForJoin(room){const mode=MODES[room.mode],count=teamCounts(room);
 if(count.A<mode.teamA)return 'A';
 if(count.B<mode.teamB)return 'B';
 return null;
}
/** O host muda a equipa do jogador; se estiver cheia troca com um adversário. */
export function switchTeam(room,id){const player=room.players.get(String(id)),mode=MODES[room.mode];
 if(!player||!mode||room.state!=='lobby')return false;
 const newTeam=player.team==='A'?'B':'A',counts=teamCounts(room),max=mode[newTeam==='A'?'teamA':'teamB'];
 if(counts[newTeam]<max){player.team=newTeam;return true;}
 const partner=[...room.players.values()].find(p=>p.team===newTeam);
 if(!partner)return false;
 partner.team=player.team;player.team=newTeam;return true;
}
