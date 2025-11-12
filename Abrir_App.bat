@echo off
setlocal EnableExtensions

rem Lanzador de Frontend + Backend con control de puertos
rem Ejecutar desde la raíz del proyecto

cd /d "%~dp0"
set "BACKEND_DIR=%~dp0backend"
set "FRONTEND_DIR=%~dp0frontend"
set "BACKEND_PORT=3001"
set "FRONTEND_BASE_PORT=5173"
set "FRONTEND_MAX_PORT=5185"
set "PREVIEW_PORT=5500"

echo ==============================================
echo Cerrando puertos si estuvieran ocupados...
echo  - Backend: %BACKEND_PORT%
echo  - Frontend: %FRONTEND_BASE_PORT%..%FRONTEND_MAX_PORT%
echo  - Preview:  %PREVIEW_PORT%
echo ==============================================

powershell -NoProfile -ExecutionPolicy Bypass -Command "
function Close-Port($port) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue;
    if ($conns) {
      $pids = $conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique;
      foreach ($pid in $pids) {
        try { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue } catch {}
      }
    }
  } catch {}
}
Close-Port %BACKEND_PORT%;
Close-Port %PREVIEW_PORT%;
for ($p = %FRONTEND_BASE_PORT%; $p -le %FRONTEND_MAX_PORT%; $p++) { Close-Port $p }
"

echo Iniciando Backend y Frontend...
rem Backend (usa npm run dev)
start "Backend" cmd /c "cd /d \"%BACKEND_DIR%\" && npm run dev"
rem Frontend (Vite dev server)
start "Frontend" cmd /c "cd /d \"%FRONTEND_DIR%\" && npm run dev"

rem Espera breve para que los servidores arranquen
timeout /t 2 >nul

rem Detecta el primer puerto de Vite que responda 200 (5173..5185) y abre navegador
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ports = %FRONTEND_BASE_PORT%..%FRONTEND_MAX_PORT% ;
Start-Sleep -Milliseconds 1200;
foreach ($p in $ports) {
  try {
    $uri = 'http://localhost:' + $p + '/';
    $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 2;
    if ($r.StatusCode -eq 200) { Start-Process $uri; exit 0 }
  } catch { }
}
"

rem Fallback: si no detectó puerto, intenta abrir el 5173 igualmente
start "" "http://localhost:%FRONTEND_BASE_PORT%/"

echo Listo: se abrieron dos consolas para backend y frontend.
pause

endlocal
exit /b 0