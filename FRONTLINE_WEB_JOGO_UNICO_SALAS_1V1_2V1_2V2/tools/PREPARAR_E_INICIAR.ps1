param([ValidateSet('Local','Internet')][string]$Modo='Local')
$ErrorActionPreference = 'Stop'
# Version 0.3: fixed malformed dual-CDN URL and added official npm fallback.
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtime = Join-Path $root '.runtime'
$vendor = Join-Path $root 'public\vendor'
$logs = Join-Path $runtime 'logs'
New-Item -ItemType Directory -Force $runtime,$vendor,$logs | Out-Null

function Say([string]$msg) { Write-Host ('[FRONTLINE] ' + $msg) -ForegroundColor Cyan }
function Download-From([string[]]$urls,[string]$destination) {
    foreach($url in $urls) {
        try {
            Say ('A transferir: ' + $url)
            Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing -MaximumRedirection 12 -TimeoutSec 90 -Headers @{'User-Agent'='Mozilla/5.0 (Windows NT 10.0; Win64; x64) FRONTLINE-WEB/0.3'}
            if ((Get-Item $destination).Length -lt 100) { throw 'O ficheiro descarregado esta vazio.' }
            return
        } catch {
            Remove-Item -Force -ErrorAction SilentlyContinue $destination
            Write-Host ('Falhou esta origem: ' + $_.Exception.Message) -ForegroundColor Yellow
        }
    }
    throw 'Nao foi possivel descarregar o ficheiro. Confirma a Internet e tenta de novo.'
}
function Get-PortableNode {
    $portable = Join-Path $runtime 'node\node.exe'
    if (Test-Path $portable) { return $portable }
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $major = [int](((& $cmd.Source -v).TrimStart('v') -split '\.')[0])
        if($major -ge 20) { Say 'Node.js instalado detetado.'; return $cmd.Source }
    }
    Say 'A preparar Node.js portatil. Nao sao necessarios direitos de administrador.'
    $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 40
    $release = $index | Where-Object { $_.lts -and ($_.files -contains 'win-x64-zip') } | Select-Object -First 1
    if (-not $release) { throw 'Nao encontrei uma distribuicao Node.js LTS x64.' }
    $v = $release.version
    $filename = 'node-' + $v + '-win-x64.zip'
    $base = 'https://nodejs.org/dist/' + $v + '/'
    $zip = Join-Path $runtime $filename
    $sums = Join-Path $runtime 'node-shasums.txt'
    Download-From @($base + $filename) $zip
    Download-From @($base + 'SHASUMS256.txt') $sums
    $match = [regex]::Match(([IO.File]::ReadAllText($sums)), '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($filename) + '\s*$')
    if(-not $match.Success) { throw 'Nao foi possivel confirmar a assinatura SHA256 do Node.js.' }
    $actual = (Get-FileHash -Algorithm SHA256 $zip).Hash
    if($actual -ine $match.Groups[1].Value) { throw 'Checksum SHA256 do Node.js nao corresponde. Download recusado.' }
    $unpack = Join-Path $runtime '_unpack'
    New-Item -ItemType Directory -Force $unpack | Out-Null
    Expand-Archive -Path $zip -DestinationPath $unpack -Force
    $executable = Get-ChildItem -Path $unpack -Filter node.exe -Recurse | Select-Object -First 1
    if(-not $executable) { throw 'node.exe nao foi encontrado no pacote.' }
    New-Item -ItemType Directory -Force (Split-Path $portable) | Out-Null
    Copy-Item $executable.FullName $portable -Force
    Remove-Item $zip,$sums -Force -ErrorAction SilentlyContinue
    Remove-Item $unpack -Recurse -Force -ErrorAction SilentlyContinue
    Say 'Node.js portatil pronto.'
    return $portable
}
# Prepares the official Three.js distribution locally. One failed CDN must NOT
# prevent the user from playing; registry tarball + three distinct CDN fallbacks.
function Test-ThreeFile([string]$name) {
    $file = Join-Path $vendor $name
    if(-not (Test-Path -LiteralPath $file)) { return $false }
    $minBytes = if($name -eq 'three.module.js') { 150000 } else { 350000 }
    if((Get-Item -LiteralPath $file).Length -lt $minBytes) { return $false }
    $stream = [IO.File]::OpenRead($file)
    try {
        $buffer = New-Object byte[] 256
        $count = $stream.Read($buffer,0,$buffer.Length)
        $begin = [Text.Encoding]::UTF8.GetString($buffer,0,$count).TrimStart()
        # Detect HTML proxy errors being saved as JavaScript.
        if($begin.StartsWith('<!DOCTYPE') -or $begin.StartsWith('<html') -or $begin.StartsWith('<HTML')) { return $false }
        if($begin.StartsWith('Bad Request') -or $begin.StartsWith('400 Bad')) { return $false }
        return $true
    } finally { $stream.Dispose() }
}
function Get-Graphics {
    if((Test-ThreeFile 'three.module.js') -and (Test-ThreeFile 'three.core.js')) {
        Say 'Motor 3D local verificado.'
        return
    }
    $names = @('three.module.js','three.core.js')
    $version = '0.186.1'
    $tarball = Join-Path $runtime 'three-0.186.1.tgz'
    $unpack = Join-Path $runtime '_three_tmp'
    $success=$false
    # npm registry distributes the two files in one official versioned archive.
    try {
        Say 'A preparar os gráficos 3D através do pacote oficial npm...'
        $npmUrl = 'https://registry.npmjs.org/three/-/three-0.186.1.tgz'
        Download-From -urls @($npmUrl) -destination $tarball
        if((Get-Item $tarball).Length -lt 1000000) { throw 'Pacote npm incompleto.' }
        $tarCommand = Get-Command tar.exe -ErrorAction SilentlyContinue
        if(-not $tarCommand) { throw 'Windows sem tar.exe: a utilizar origens alternativas.' }
        if(Test-Path $unpack) { Remove-Item -Recurse -Force $unpack }
        New-Item -ItemType Directory -Force $unpack | Out-Null
        & $tarCommand.Source -xzf $tarball -C $unpack 'package/build/three.module.js' 'package/build/three.core.js'
        if($LASTEXITCODE -ne 0) { throw 'Não foi possível extrair o pacote 3D.' }
        foreach($name in $names) {
            $source = Join-Path $unpack ('package\build\' + $name)
            if(-not (Test-Path $source)) { throw ('O pacote 3D não inclui ' + $name) }
            Copy-Item -LiteralPath $source -Destination (Join-Path $vendor $name) -Force
            if(-not (Test-ThreeFile $name)) { throw ('O ficheiro ' + $name + ' está incompleto.') }
        }
        $success=$true
        Say 'Pacote 3D obtido e verificado.'
    } catch {
        Write-Host ('Origem npm indisponível: ' + $_.Exception.Message) -ForegroundColor Yellow
        Say 'A testar origens alternativas para os gráficos...'
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tarball
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $unpack
    }
    if(-not $success) {
        foreach($name in $names) {
            if(Test-ThreeFile $name) { continue }
            # IMPORTANT: construct complete URL strings individually. The v0.2
            # launcher accidentally combined two URLs into one invalid request.
            $cdn1 = "https://cdnjs.cloudflare.com/ajax/libs/three.js/$version/$name"
            $cdn2 = "https://cdn.jsdelivr.net/npm/three@$version/build/$name"
            $cdn3 = "https://unpkg.com/three@$version/build/$name"
            $target = Join-Path $vendor $name
            Download-From -urls @($cdn1,$cdn2,$cdn3) -destination $target
            if(-not (Test-ThreeFile $name)) {
                Remove-Item -Force -ErrorAction SilentlyContinue $target
                throw ('Transferência inválida de ' + $name + '. O servidor pode ter devolvido uma página de erro.')
            }
        }
    }
    if(-not ((Test-ThreeFile 'three.module.js') -and (Test-ThreeFile 'three.core.js'))) {
        throw 'A preparação do Three.js não terminou. Os dois módulos são necessários.'
    }
    Say 'Three.js pronto. Os gráficos ficam guardados para as próximas partidas.'
}
function Get-Cloudflared {
    $exe = Join-Path $runtime 'cloudflared-windows-amd64.exe'
    if(Test-Path $exe) { return $exe }
    Say 'A obter ferramenta oficial da Cloudflare para o jogo temporario na Internet.'
    $info = Invoke-RestMethod -Uri 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest' -Headers @{'User-Agent'='FrontlineWeb-Launcher'} -TimeoutSec 40
    $asset = $info.assets | Where-Object { $_.name -eq 'cloudflared-windows-amd64.exe' } | Select-Object -First 1
    if(-not $asset) { throw 'O ficheiro Windows da Cloudflare nao esta disponivel nesta versao.' }
    Download-From @($asset.browser_download_url) $exe
    $checksum = ''
    if($asset.digest -match '^sha256:([a-fA-F0-9]{64})$') { $checksum=$Matches[1] }
    if((-not $checksum) -and $info.body -match '(?im)cloudflared-windows-amd64\.exe:\s*([a-fA-F0-9]{64})') { $checksum=$Matches[1] }
    if(-not $checksum) { Remove-Item $exe -Force; throw 'Nao foi possivel verificar a integridade SHA256 da ferramenta Cloudflare.' }
    if((Get-FileHash $exe -Algorithm SHA256).Hash -ine $checksum) { Remove-Item $exe -Force; throw 'A integridade SHA256 da ferramenta Cloudflare falhou.' }
    return $exe
}
function Get-FreePort {
    foreach($p in 3000..3020) {
        $listener=$null
        try {
            $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$p)
            $listener.Start()
            return $p
        } catch [Net.Sockets.SocketException] {
            continue
        } finally {
            if($listener) { $listener.Stop() }
        }
    }
    throw 'Todas as portas 3000 a 3020 estao ocupadas. Fecha outras instancias do jogo.'
}

$server=$null
try {
    Say ('Modo: ' + $Modo)
    $node = Get-PortableNode
    Get-Graphics
    if($Modo -eq 'Internet') {
       Write-Host ''
       Write-Host 'ATENCAO: Vais publicar temporariamente o jogo na Internet.' -ForegroundColor Yellow
       Write-Host 'Qualquer pessoa com o endereco gerado podera abrir o jogo.' -ForegroundColor Yellow
       Write-Host 'Nao partilhes o endereco publicamente. Fecha esta janela para terminar.' -ForegroundColor Yellow
       $ok = Read-Host 'Queres continuar? (S/N)'
       if($ok -notin @('s','S','sim','SIM')) { Say 'Cancelado.'; exit 0 }
       $cloudflared = Get-Cloudflared
    }
    $port=Get-FreePort
    if($port -ne 3000) { Say ('A porta 3000 esta ocupada. Vou usar automaticamente a porta ' + $port + '.') }
    $env:PORT = [string]$port
    $stdout=Join-Path $logs 'servidor.log'
    $stderr=Join-Path $logs 'servidor-erros.log'
    $server = Start-Process -FilePath $node -ArgumentList @('server/index.js') -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $ready=$false
    for($i=0; $i -lt 35; $i++) {
       Start-Sleep -Milliseconds 300
       if($server.HasExited) { throw ('O servidor terminou. Consulta .runtime/logs/servidor-erros.log') }
       try { $h=Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/health') -TimeoutSec 1; if($h.ok) {$ready=$true; break} } catch {}
    }
    if(-not $ready) { throw ('O servidor nao respondeu na porta ' + $port + '.') }
    Say 'O jogo esta pronto.'
    Start-Process ('http://localhost:' + $port + '/')
    if($Modo -eq 'Internet') {
       Write-Host ''
       Say 'A criar endereco temporario para partilhares com o teu amigo...'
       Write-Host 'Aguarda o endereco https://...trycloudflare.com no texto abaixo.' -ForegroundColor Yellow
       Write-Host 'O teu amigo abre esse endereco, e um de voces cria a sala de 6 caracteres.' -ForegroundColor Yellow
       Write-Host 'Para terminar, fecha esta janela ou usa Ctrl+C.' -ForegroundColor Yellow
       & $cloudflared tunnel --url "http://localhost:$port" --no-autoupdate
    } else {
       Write-Host ('Jogo aberto em http://localhost:' + $port + '/')
       Write-Host 'Podes jogar a solo ou testar uma sala com duas abas.'
       [void](Read-Host 'Prima ENTER para desligar o jogo')
    }
} catch {
    Write-Host ''
    Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Se persistir, envia-me uma captura desta janela. O problema pode ser bloqueio da rede aos servidores de transferência.'
    [void](Read-Host 'Prima ENTER para sair')
} finally {
    if($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}
