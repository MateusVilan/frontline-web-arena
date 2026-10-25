@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo E NECESSARIO INSTALAR O NODE.JS: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\ws" (
  echo A instalar dependencias pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias. Confirma a Internet.
    pause
    exit /b 1
  )
)
echo A iniciar o servidor numa janela propria...
start "FRONTLINE.WEB SERVIDOR" cmd /k "npm start"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"
echo Podes fechar esta janela. Para parar o servidor, fecha a janela FRONTLINE.WEB SERVIDOR.
