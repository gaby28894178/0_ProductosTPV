const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function backup() {
  const repoDir = path.join(__dirname, '..', '..');
  const backendDir = path.join(repoDir, 'backend');
  const dbFile = path.join(backendDir, 'data.sqlite');
  if (!fs.existsSync(dbFile)) {
    console.log('No existe base de datos, se omite respaldo.');
    return;
  }
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');

  // Estructura: backp/YYYY/MM/DD/data.sqlite
  const backupBase = path.join(repoDir, 'backp', yyyy, mm, dd);
  ensureDir(backupBase);
  const outFile = path.join(backupBase, `data_${yyyy}${mm}${dd}_${hh}${mi}.sqlite`);

  fs.copyFileSync(dbFile, outFile);
  console.log('Respaldo creado en:', outFile);
}

try {
  backup();
  process.exit(0);
} catch (e) {
  console.error('Error de respaldo:', e.message);
  process.exit(1);
}