#!/usr/bin/env node
/**
 * Preflight de migración a Vercel: comprobación estática no invasiva.
 * No accede a Firebase ni realiza despliegues.
 */
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const server = read('server.ts');
const service = read('src/server/workerPortalService.ts');
const packageJson = JSON.parse(read('package.json') || '{}');
const fails = [];
const checks = [
  ['API desacoplada de listener local',
    !/app\.listen\s*\(/.test(server),
    'El servidor Express sigue llamando app.listen(): extraer app y mantener listener solo en entrada local.'],
  ['Estado crítico no almacenado solo en memoria',
    !/workersDb\.push\(|projectsDb\.push\(|timeRecordsDb\.unshift\(|document\.signed\s*=/.test(server + service),
    'CRUD/fichajes/firmas modifican arrays locales: utilizar repositorios persistentes Firestore.'],
  ['Inicialización Firestore independiente de fichero local',
    !/existsSync\(configPath\)/.test(service),
    'Firestore depende de firebase-applet-config.json local y admite fallback en memoria.'],
  ['Sin datos de plantilla empotrados',
    !/export const workersDb:\s*Worker\[\]\s*=\s*\[\s*\{/.test(service),
    'La fuente del trabajador contiene registros empotrados; revisar privacidad antes de compartir Preview.'],
  ['Adaptador HTTP Vercel presente',
    existsSync('api/index.ts'),
    'Falta api/index.ts; no activar Vercel hasta implantar autenticación y persistencia.'],
  ['Configuración de enrutamiento Vercel presente',
    existsSync('vercel.json'),
    'Falta vercel.json; configurar funciones API y fallback SPA antes de desplegar.'],
  ['Pruebas disponibles',
    Boolean(packageJson.scripts?.test),
    'Falta script de pruebas automatizadas.']
];

for (const [label, passed, advice] of checks) {
  console.log(`${passed ? 'OK' : 'BLOQUEADO'} — ${label}`);
  if (!passed) fails.push(advice);
}
if (fails.length) {
  console.error('\nBloqueos pendientes:');
  fails.forEach((problem, index) => console.error(`${index + 1}. ${problem}`));
  process.exitCode = 1;
} else {
  console.log('\nComprobación estática superada. Aún se requieren pruebas de integración y seguridad.');
}
