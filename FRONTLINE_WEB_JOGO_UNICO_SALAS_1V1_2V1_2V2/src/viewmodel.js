// Enquadramento solicitado a partir da captura do jogador em 24/10/2026.
// Correspondente às posições da V1.4.5: cano junto ao centro sem tapar a mira,
// coronha no canto inferior direito e braços visíveis.
export const VIEWMODEL_POSES=Object.freeze({
  m4:Object.freeze({x:.41,y:-.41,z:-1.46,yaw:.18,pitch:.010,roll:-.020,scale:.47}),
  ak:Object.freeze({x:.42,y:-.41,z:-1.48,yaw:.19,pitch:.012,roll:-.022,scale:.48}),
  mp9:Object.freeze({x:.40,y:-.43,z:-1.35,yaw:.23,pitch:.014,roll:-.028,scale:.52}),
  pistol:Object.freeze({x:.36,y:-.36,z:-1.34,yaw:.21,pitch:.010,roll:-.016,scale:.54}),
  knife:Object.freeze({x:.41,y:-.55,z:-1.16,yaw:.17,pitch:.013,roll:-.060,scale:.61})
});

export function viewmodelPose(id){return VIEWMODEL_POSES[id]??VIEWMODEL_POSES.m4;}
