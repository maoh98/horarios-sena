// Horario SENA · utilidades de verificación para Node (lectura de carpetas) — Node 18+
// Creado por el Ing. Manuel Alejandro Ordóñez Hernández
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
export {canon, verificar, resumen, huellaWeb} from './nucleo.mjs';

export function archivos(dir) {
  return readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && f !== 'administrador.json').sort((a, b) => a.localeCompare(b, 'es'));
}
export const leer = (dir, f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
