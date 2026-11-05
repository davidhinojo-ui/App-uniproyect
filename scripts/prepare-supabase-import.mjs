import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const collections = {
  obras: ['obras'], documentos: ['documentos'], personal: ['personal'],
  gastosGenerales: ['gastosGenerales', 'otrosGastos'], proveedores: ['proveedores'],
  trabajadores: ['trabajadores'], plantillaTrabajadores: ['trabajadoresEmpresa', 'plantillaTrabajadores'],
  fichajes: ['fichajes'], notifications: ['notifications'],
};
export function prepareImport(backup) {
  const source = backup?.data ?? backup;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Copia no válida.');
  const operations = [];
  const summary = {};
  for (const [collection, names] of Object.entries(collections)) {
    const rows = names.map(name => source[name]).find(value => value !== undefined) ?? [];
    if (!Array.isArray(rows)) throw new Error(`La colección ${collection} debe ser una lista.`);
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string' || !row.id || row.id.length > 200 || ids.has(row.id)) {
        throw new Error(`Identificador ausente, duplicado o no válido en ${collection}.`);
      }
      ids.add(row.id);
      // Preserve the original business fields without copying permissions or credentials.
      const { pin, password, access_token, refresh_token, ...data } = row;
      operations.push({ collection, id: row.id, action: 'set', data });
    }
    summary[collection] = rows.length;
  }
  if (!operations.length) throw new Error('La copia no contiene registros que importar.');
  return { summary, operations };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2]) throw new Error('Uso: node scripts/prepare-supabase-import.mjs copia.json [--write]');
    const prepared = prepareImport(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify({ ...prepared.summary, total: prepared.operations.length }));
    if (process.argv.includes('--write')) {
      fs.mkdirSync('migration-private', { recursive: true });
      fs.writeFileSync('migration-private/import.json', JSON.stringify(prepared.operations), { flag: 'wx' });
      console.log('Preparación guardada en migration-private/import.json. No se ha conectado con ninguna base de datos.');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
