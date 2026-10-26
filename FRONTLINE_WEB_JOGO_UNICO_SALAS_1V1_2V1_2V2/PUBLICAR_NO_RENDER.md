# FRONTLINE.WEB — publicar o JOGO ÚNICO no Render

Este é o mesmo jogo usado no Windows; não precisas de uma versão ou servidor separado.

1. Extrai o ficheiro ZIP.
2. Envia **o conteúdo extraído** para a raiz do repositório GitHub ligado ao Render (não coloques tudo dentro de mais uma pasta).
3. Confirma que se vê `package.json` na página inicial do repositório, ao lado de `public`, `src`, `server` e `shared`.
4. Em Render → Web Service → Settings: `Root Directory` vazio, `Build Command`: `npm install --omit=dev`, `Start Command`: `npm start`.
5. Faz commit no GitHub; se não publicar automaticamente, escolhe Manual Deploy → Deploy latest commit.
6. Quando estiver Live, abre o endereço HTTPS do Render. Usa CRIAR SALA COM AMIGO e COPIAR CONVITE para partilhar.

Para testar o servidor, abre `https://o-teu-servico.onrender.com/health`. Se houver erro `ENOENT package.json`, confirma o ponto 3.

**Atenção:** no plano gratuito, o servidor pode adormecer; reinícios apagam as salas que estavam apenas em memória.
