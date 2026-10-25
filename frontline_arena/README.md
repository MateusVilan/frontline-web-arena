# FRONTLINE.WEB — Arena Multiplayer v2.0 (protótipo separado)

Este projeto é uma **arena 3D multiplayer separada**, preparada para incorporar posteriormente no FRONTLINE.WEB v1.4.6. O ZIP original da versão v1.4.6 não estava disponível nesta conversa, por isso **não foram alteradas as armas ou os ficheiros dessa versão**.

## Incluído

- 2 mapas 3D: **Dockyard** e **Foundry**, com caminhos alternativos, coberturas, cenários industriais distintos e **radar** (apenas colegas de equipa).
- Partidas privadas **1v1 / 2v1 / 2v2**, com código de 5 caracteres e partilha de link.
- Movimento WASD, passo silencioso (Shift), agachar (Ctrl), saltar (Espaço), rifle (1), P250 (2), butterfly (3), inspecionar (F), recarregar (R), placar (Tab).
- Servidor multiplayer com WebSockets; snapshots 15 vezes/segundo, predição local, interpolação com buffer de 100 ms para outros jogadores, validação dos tiros, dos limites de velocidade e de colisões no servidor.
- Rounds com limite de 90 segundos, primeiro a 5; dano, eliminações e scoreboard. Não é preciso clicar para recuperar o rato entre rounds.
- **Reconexão automática** à mesma sala, se a ligação cair e voltar em cerca de 12 segundos (ou após atualizar a página).
- Indicador de **ping** e contador de FPS baseado nos fotogramas realmente apresentados.
- Ajustes manuais de resolução, limite de FPS, sensibilidade, volume geral e **volume separado dos passos**. Sem alternância automática de qualidade. Passos de som discreto.
- Paredes/caixas por **instancing** no GPU, sem sombras dinâmicas nem partículas pesadas.

## Arrancar no computador

É necessário instalar Node.js 20+ e ter Internet (o cliente carrega Three.js a partir de um CDN).

```sh
npm install
npm start
```

Abre `http://localhost:3000` no navegador. O servidor usa a porta `3000` por defeito, ou a variável de ambiente `PORT`.

**Para testar 1v1:** abre em dois dispositivos ou duas janelas de navegador, cria sala no primeiro, copia o código/link e entra no outro; o host clica em **Começar partida**. Para 2v1, entram 3 jogadores; para 2v2, entram 4.

## Publicar e partilhar o mesmo link

O projeto deve ser alojado numa plataforma que suporte **Node.js + WebSockets** (por exemplo, Render, Fly.io ou Railway):

1. Descompacta e coloca esta pasta num repositório GitHub.
2. Cria um serviço **Web Service** Node nesse repositório.
3. Se usares Render, o `render.yaml` incluído já descreve o serviço. Nas outras plataformas, utiliza `npm install` no build e `npm start` no start.
4. Distribui a URL pública do serviço, que serve o site e o WebSocket no mesmo domínio. Os amigos entram no mesmo endereço e introduzem o código.

**Nota:** O Netlify Drop, sozinho, é alojamento estático e não executa este servidor WebSocket Node. Para multiplayer real, todos precisam de se ligar ao mesmo backend online.

## Limites deste protótipo

- Requer que o servidor fique online, e não é compatível com modos peer-to-peer/offline.
- As armas e a apresentação são demonstrativas: não substituem os modelos e a loja da v1.4.6.
- Não inclui contas, persistência de estatísticas, chat ou proteção profissional contra cheats.
- O servidor necessita de `npm install` (pacote WebSocket `ws`) e o navegador precisa de ligação para obter Three.js. Neste ambiente, o registo npm não estava acessível, pelo que **ainda não consegui executar uma partida real de rede com dois navegadores**. A dependência `ws` tem de ser instalada com `npm install` no teu computador ou alojamento. Verifiquei a sintaxe e os testes automáticos de mapas, colisões, equipas, percursos, velocidades, regras de tiro, compensação de lag e limites. **Estes testes não substituem uma partida real em computadores diferentes.**

## Novidades da v2.0

- **Modo espectador em primeira pessoa corrigido:** a câmara acompanha de facto a posição interpolada e o olhar do colega da mesma equipa. A tua arma fica oculta, o HUD mostra os dados do colega e Q/E alterna entre colegas vivos. Antes a indicação de espectador mudava, mas a câmara ficava no local onde tinhas morrido.
- **Modelo certo após cada round:** ao recomeçar, a arma visível volta a ser o rifle, mesmo que o round anterior tenha terminado com a pistola ou a faca selecionada. Corrige a dessincronização entre o HUD e o modelo 3D.
- **Colegas bloqueiam disparos:** com fogo amigo desligado, tiros não causam dano aos aliados nem atravessam o corpo deles para atingir adversários por trás.
- **Rounds e quedas de ligação:** um novo round só começa quando as equipas necessárias estão ligadas. O servidor aguarda a reconexão dentro da tolerância existente (cerca de 12 s); após expirar, a sala volta ao lobby.
- **40 testes automáticos aprovados** e verificação de sintaxe sem erros. Não substituem ensaios reais em dispositivos diferentes.

## Novidades da v1.9

- **Preparação do modo espectador após eliminação:** escolha de colegas vivos com **Q** e **E** (a câmara em primeira pessoa ficou corrigida na v2.0). Em 1v1 aguarda pelo round seguinte.
- **Arma em modo espectador:** o teu modelo deixa de tapar a câmara. A mira e a tua arma desaparecem enquanto estás eliminado.
- **Resolução gráfica corrigida:** os níveis 50–100% alteram efetivamente a quantidade de píxeis renderizados, inclusive em monitores de DPR=1. Continua a ser manual, sem modo automático.
- **Menos carga gráfica nos menus e em pausa:** em segundo plano, a taxa de renderização baixa, mantendo a simulação do jogo e os controlos de rede.
- **Troca de armas mais justa:** rifle, P250 e butterfly têm um breve tempo de preparação antes de poder disparar; o servidor também valida essa espera, impedindo disparos antecipados.
- **Menos pacotes inúteis:** o cliente não envia deslocações quando está eliminado ou com o jogo em pausa.
- **Validação:** 36 testes automáticos e verificação de sintaxe. Estes testes não equivalem a testar uma partida real com dois dispositivos.

## Novidades da v1.8

- **Tiros com menos sensação de atraso:** o servidor conserva um pequeno histórico de posições previamente validadas e, com base na latência medida por ping/pong **no próprio servidor**, permite compensar até 125 ms em disparos de armas de fogo. O alvo tem de continuar vivo e a arma continua sujeita às paredes, distância e dispersão. Os golpes de faca não têm compensação retroativa.
- **Escolha de equipas:** o host pode clicar em **↔ EQUIPA** junto de um jogador no lobby. Se o lado oposto estiver cheio, troca de lugar com outro jogador. No 2v1 é possível escolher quem joga sozinho; mudar apenas o mapa não desfaz a escolha de equipas.
- **Início com equipas corretas:** além de todos estarem ligados, o servidor verifica se existem exatamente os jogadores necessários em cada equipa.
- **Recarga consistente:** uma confirmação de munição após disparo já não cancela antecipadamente a animação de recarga.
- **Sair sem bloqueio do rato:** os botões para sair da sala ou partida libertam o ponteiro e fecham os painéis e o placar.
- **Arranque no Windows:** o ficheiro BAT abre o servidor na sua própria janela, aguarda brevemente e só depois abre o navegador. Fechar a janela do servidor termina a sessão local.
- **Testes automáticos:** 25 passaram com `npm test`, e o JavaScript passou na verificação de sintaxe `npm run check`.

## Melhorias da v1.7

- **Rounds mais seguros:** a partida só inicia se todos os jogadores estiverem ligados; sockets abandonados são terminados por verificação periódica de ligação.
- **Relógio sincronizado com o servidor:** o tempo já não depende apenas do relógio do computador.
- **Novo cálculo dos tiros:** o servidor valida tiros contra o mapa, paredes e equipas, e calcula dispersão diferente conforme a arma, a velocidade real e agachamento.
- **Faca:** alcance corpo-a-corpo validado pela distância real entre jogadores (incluindo hitbox).
- **Feedback:** efeito visual de tiro, acertos, dano e headshots mais claros; indicação da equipa vencedora de cada round.
- **Definições:** FOV manual entre 70° e 100°, com persistência local.
- **Áudio:** passos em ruído filtrado de curta duração, em vez de um tom eletrónico; mantém volume independente.
- **Eficiência:** geometrias e materiais de personagens e efeitos reutilizados, evitando recriações repetidas.
- **Testes na versão 1.7:** 16 testes automáticos passaram (`npm test`), além de verificação de sintaxe (`npm run check`). O menu e as definições foram inspecionados visualmente em navegador.

## Melhorias herdadas da v1.6

- Movimentos remotos interpolados: animação mais estável em ligações com jitter.
- Servidor recusa deslocações demasiado rápidas e percursos que atravessem obstáculos.
- UDP não é usado: é WebSocket sobre TCP, logo ping elevado pode ainda afetar o jogo.
- A sala tenta recuperar a sessão no mesmo separador do navegador após uma quebra breve; sair pelo botão elimina a sessão.
- FPS e volume dos passos independentes para ajustar desempenho e som ao gosto do jogador.

**Nota importante:** `INICIAR_WINDOWS.bat` arranca o servidor no **teu computador**. Os teus amigos fora da mesma rede só conseguem ligar-se através de alojamento público com suporte a Node.js/WebSockets (ou com configuração explícita de rede, não incluída).
