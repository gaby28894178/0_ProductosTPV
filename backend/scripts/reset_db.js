const fs = require('fs');
const path = require('path');

function getResetPassword() {
  try {
    const repoDir = path.join(__dirname, '..', '..')
    const jsonPath = path.join(repoDir, 'backend', 'assets', 'company.json')
    const raw = fs.readFileSync(jsonPath, 'utf8')
    const data = JSON.parse(raw)
    const value = String(data.reset_password || '').trim()
    return value || '28894178'
  } catch (e) {
    return '28894178'
  }
}

function backup() {
  const backupScript = path.join(__dirname, 'backup_db.js');
  require(backupScript);
}

function reset(passArg) {
  const expected = getResetPassword()
  if (String(passArg) !== expected) {
    console.error('Password incorrecto.');
    process.exit(2);
  }
  const backendDir = path.join(__dirname, '..');
  const dbFile = path.join(backendDir, 'data.sqlite');
  try { backup(); } catch (e) { console.error('Error creando respaldo:', e.message); }
  if (fs.existsSync(dbFile)) {
    try {
      fs.rmSync(dbFile);
      console.log('Base de datos borrada:', dbFile);
    } catch (e) {
      console.error('No se pudo borrar la base de datos. Cerrar el servidor backend y reintentar.');
      process.exit(1);
    }
  } else {
    console.log('No existe base de datos, nada para borrar.');
  }
}

try {
  const passArg = process.argv[2] || '';
  reset(passArg);
  process.exit(0);
} catch (e) {
  console.error('Error al resetear:', e.message);
  process.exit(1);
}