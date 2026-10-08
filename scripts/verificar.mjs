#!/usr/bin/env node
// Verifica TODOS los archivos de instructores:
//  1) que estén sellados y que la firma coincida con el contenido;
//  1b) que el horario cumpla las reglas (6 a. m.–10 p. m., sin cruces, sin festivos, límites de apoyo, máx. 3 programas);
//  2) que la llave pública no haya cambiado respecto a la rama base (evita que alguien
//     reemplace el archivo de un instructor por otro firmado con otra llave).
// Uso: node scripts/verificar.mjs [carpeta=horarios]     (BASE_REF = commit/rama base)
import {execFileSync} from 'node:child_process';
import {archivos, leer, verificar, resumen} from './lib.mjs';

const dir = process.argv[2] || 'horarios';
const base = process.env.BASE_REF && !/^0+$/.test(process.env.BASE_REF) ? process.env.BASE_REF : 'origin/main';
let errores = 0, avisos = 0;
const nombres = new Map();
/* llave pública del administrador (horarios/administrador.json): solo se comprueba que esté bien formada */
try {
  const a = JSON.parse((await import('node:fs')).readFileSync(`${dir}/administrador.json`, 'utf8'));
  const ok = a && a.app === 'horario-sena-admin' && /^[A-Za-z0-9+\/=]{100,200}$/.test(a.pub || '');
  if (ok) await crypto.subtle.importKey('spki', Uint8Array.from(atob(a.pub), c => c.charCodeAt(0)), {name: 'ECDH', namedCurve: 'P-256'}, false, []);
  if (ok) console.log(`✓ ${dir}/administrador.json · llave de administrador${a.nombre ? ' de ' + a.nombre : ''}`);
  else { console.error(`✗ ${dir}/administrador.json: no tiene el formato de llave de administrador`); errores++; }
} catch (e) { if (e.code !== 'ENOENT') { console.error(`✗ ${dir}/administrador.json: ${e.message}`); errores++; } }

for (const f of archivos(dir)) {
  const ruta = `${dir}/${f}`;
  let j;
  try { j = leer(dir, f); } catch (e) { console.error(`✗ ${ruta}: JSON inválido`); errores++; continue; }
  if (j.app === 'horario-sena-admin-llave') { console.error(`✗ ${ruta}: es la copia PRIVADA de tu llave de administrador. Bórrala del repositorio ahora (en GitHub: abre el archivo → icono de papelera → Commit) y publica solo administrador.json.`); errores++; continue; }
  if (j.app !== 'horario-sena' || !Array.isArray(j.blocks)) { console.error(`✗ ${ruta}: no es un archivo de Horario SENA`); errores++; continue; }
  const v = await verificar(j);
  if (!v.ok) { console.error(`✗ ${ruta}: ${v.motivo}`); errores++; continue; }
  // llave fijada (pinning) contra la rama base
  try {
    const previo = JSON.parse(execFileSync('git', ['show', `${base}:${ruta}`], {stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024}).toString());
    if (previo.lock && previo.lock.pub && previo.lock.pub !== j.lock.pub) {
      console.error(`✗ ${ruta}: la llave de firma cambió respecto a ${base}. Solo el dueño original puede actualizar este archivo.`); errores++; continue;
    }
    /* la versión nunca puede retroceder (así una copia vieja no pisa lo que corrigió el administrador) */
    const rp = Number.isInteger(previo.rev) ? previo.rev : 0, rn = Number.isInteger(j.rev) ? j.rev : 0;
    if (rp && rn < rp) { console.error(`✗ ${ruta}: la versión (${rn}) es más vieja que la ya guardada (${rp}).`); errores++; continue; }
  } catch { /* archivo nuevo: no hay con qué comparar */ }
  const r = resumen(j, f);
  if (!r.reglas.ok) {   // el horario debe encajar con las reglas (jornada, cruces, festivos, apoyo, máx. 3 programas)
    console.error(`✗ ${ruta}: el horario no cumple las reglas:`);
    r.reglas.problemas.slice(0, 10).forEach(x => console.error('    - ' + x));
    if (r.reglas.problemas.length > 10) console.error(`    …y ${r.reglas.problemas.length - 10} más`);
    errores++; continue;
  }
  if (nombres.has(r.nombre.toLowerCase())) { console.warn(`! ${ruta}: el nombre "${r.nombre}" ya existe en ${nombres.get(r.nombre.toLowerCase())}`); avisos++; }
  nombres.set(r.nombre.toLowerCase(), f);
  console.log(`✓ ${ruta} · ${r.nombre} · huella ${v.huella} · ${r.horas.total} h (10°: ${r.grados['10']} h · 11°: ${r.grados['11']} h)`);
}
console.log(`\n${errores ? '✗' : '✓'} ${nombres.size} archivo(s) correcto(s), ${errores} con error, ${avisos} aviso(s).`);
process.exit(errores ? 1 : 0);
