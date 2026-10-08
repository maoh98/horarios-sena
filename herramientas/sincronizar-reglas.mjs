#!/usr/bin/env node
// Copia las reglas del planeador (bloque LOGIC de horario-sena.html, la copia LEGIBLE) a:
//   scripts/reglas.mjs  (lo usa el chequeo de Git y el generador del Excel)
//   admin.html          (entre las marcas /*<REGLAS>*/ y /*</REGLAS>*/)
// Así el planeador, el panel y Git aplican EXACTAMENTE las mismas reglas.
// Uso: node herramientas/sincronizar-reglas.mjs ruta/a/horario-sena.html
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fuente = readFileSync(process.argv[2] || 'horario-sena.html', 'utf8');
const m = fuente.match(/\/\/ <LOGIC>([\s\S]*?)\/\/ <\/LOGIC>/);
if (!m) { console.error('No encontré el bloque // <LOGIC> en el archivo. ¿Es la copia legible (no la reducida)?'); process.exit(1); }
const logica = m[1];
const EXPORTS = 'gradoHoras, auditar, validateBlock, isWorkable, holidays, indicators, INSTITUCIONES, TIPOS_INST, RULES, instFija, tipoValido, normInst';

writeFileSync(join(raiz, 'scripts/reglas.mjs'),
`// GENERADO por herramientas/sincronizar-reglas.mjs a partir de horario-sena.html. No editar a mano.
// Horario SENA · creado por el Ing. Manuel Alejandro Ordóñez Hernández
${logica}
export {${EXPORTS}};
`);

const adminPath = join(raiz, 'admin.html');
let admin = readFileSync(adminPath, 'utf8');
const bloque = `/*<REGLAS>*/\nconst R=(()=>{${logica}\nreturn {${EXPORTS}};})();\n/*</REGLAS>*/`;
if (!/\/\*<REGLAS>\*\/[\s\S]*?\/\*<\/REGLAS>\*\//.test(admin)) { console.error('admin.html no tiene las marcas /*<REGLAS>*/'); process.exit(1); }
admin = admin.replace(/\/\*<REGLAS>\*\/[\s\S]*?\/\*<\/REGLAS>\*\//, () => bloque);
writeFileSync(adminPath, admin);
console.log('✓ reglas sincronizadas en scripts/reglas.mjs y admin.html');
