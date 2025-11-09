@echo off
setlocal EnableExtensions

rem Lanzador simple de Frontend + Backend
rem Ejecutar desde la raíz del proyecto

cd /d "%~dp0"
set "BACKEND_DIR=%~dp0backend"
set "FRONTEND_DIR=%~dp0frontend"

echo Iniciando Backend y Frontend...
rem Backend (usa npm run dev)
start "Backend" cmd /c "cd /d \"%BACKEND_DIR%\" && npm run dev"
rem Frontend (Vite dev server)
start "Frontend" cmd /c "cd /d \"%FRONTEND_DIR%\" && npm run dev"

rem Espera breve para que los servidores arranquen
timeout /t 2 >nul

rem Detecta el primer puerto de Vite que responda 200 (5173..5185) y abre navegador
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$ports = 5173..5185;
Start-Sleep -Milliseconds 800;
foreach ($p in $ports) {
  try {
    $r = Invoke-WebRequest -Uri ('http://localhost:' + $p + '/') -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 2;
    if ($r.StatusCode -eq 200) { Start-Process ('http://localhost:' + $p + '/'); exit 0 }
  } catch { }
}
"

rem Fallback: si no detectó puerto, intenta abrir el 5173 igualmente
start "" "http://localhost:5173/"

echo Listo: se abrieron dos consolas para backend y frontend.
pause

endlocal
exit /b 0