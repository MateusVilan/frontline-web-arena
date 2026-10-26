# FRONTLINE.WEB — Jogo único, salas PvP completas

O mesmo jogo original: armas, loja, quatro mapas, solo e multiplayer, agora com **lobby antes das partidas PvP**.

## Como criar uma sala

1. Abre o FRONTLINE.WEB.
2. Em **SALAS PRIVADAS · MULTIPLAYER**, escolhe **1v1**, **2v1**, **2v2** ou **Cooperativo**.
3. Escolhe **Arena Ferrugem** ou **Terminal Azul** para PvP (ou **Bloco Industrial / Porto Noturno** para cooperativo).
4. Escreve o teu nickname e clica em **CRIAR SALA COM AMIGO**.
5. No lobby, copia o convite ou o código de seis caracteres. Os teus amigos abrem o mesmo jogo e introduzem o código, se necessário.
6. O anfitrião pode alterar o modo, o mapa e as equipas. Quando o lobby tiver todos os jogadores e a composição correta, fica disponível **COMEÇAR PARTIDA**.
7. A partida abre o mesmo jogo 3D, com as cinco armas, a loja, o HUD Arena Pro e o placar K/D. Clica no ecrã para prender o rato ao jogo.

### Equipas

- 1v1: 1 azul contra 1 laranja.
- 2v1: 2 azuis contra 1 laranja.
- 2v2: 2 azuis contra 2 laranjas.

O anfitrião pode mudar os jogadores de equipa no lobby; se a equipa estiver cheia, a mudança troca dois jogadores. Uma partida PvP com lobby não começa sem os jogadores necessários e não aceita novas entradas depois de iniciada.

O cooperativo continua a iniciar diretamente, como antes, e permite até dois jogadores.

## Windows

Extrai o ZIP e executa `JOGAR_FRONTLINE.bat`. É necessário ter Node.js 20+ instalado.

## Render

Usa exatamente os mesmos ficheiros do ZIP num repositório GitHub; deixa `package.json` na raiz. Cria um **Web Service** no Render com **Build Command** `npm install --omit=dev` e **Start Command** `npm start`. Usa a instância Free se estiver disponível. O servidor respeita a variável `PORT` fornecida pelo Render. Todos abrem o mesmo endereço do Render.

## Testes

Com o servidor ativo, `npm run test:rooms` testa os modos 1v1, 2v1 e 2v2 com WebSockets simulados. Os testes anteriores continuam disponíveis nos scripts do package.json.

**Limitação:** os testes automáticos passam, mas não substituem a experiência de uma partida real em vários navegadores. O navegador de teste deste ambiente bloqueia acesso à porta local.
