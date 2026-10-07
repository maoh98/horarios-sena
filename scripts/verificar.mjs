#!/usr/bin/env node
// Verifica TODOS los archivos de instructores:
//  1) que estén sellados y que la firma coincida con el contenido;
//  1b) que el horario cumpla las reglas (6 a. m.–6 p. m., sin cruces, sin festivos, límites de apoyo, máx. 2 o 3 programas);
//  2) que la llave pública no haya cambiado respecto a la rama base (evita que alguien
//     reemplace el archivo de un instructor por otro firmado con otra llave).
// Uso: node scripts/verificar.mjs [carpeta=horarios]     (BASE_REF = commit/rama base)
import {execFileSync} from 'node:child_process';
import {archivos, leer, verificar, resumen} from './lib.mjs';

const dir = process.argv[2] || 'horarios';
const base = process.env.BASE_REF && !/^0+$/.test(process.env.BASE_REF) ? process.env.BASE_REF : 'origin/main';
let errores = 0, avisos = 0;
const nombres = new Map();

for (const f of archivos(dir)) {
  const ruta = `${dir}/${f}`;
  let j;
  try { j = leer(dir, f); } catch (e) { console.error(`✗ ${ruta}: JSON inválido`); errores++; continue; }
  if (j.app !== 'horario-sena' || !Array.isArray(j.blocks)) { console.error(`✗ ${ruta}: no es un archivo de Horario SENA`); errores++; continue; }
  const v = await verificar(j);
  if (!v.ok) { console.error(`✗ ${ruta}: ${v.motivo}`); errores++; continue; }
  // llave fijada (pinning) contra la rama base
  try {
    const previo = JSON.parse(execFileSync('git', ['show', `${base}:${ruta}`], {stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024}).toString());
    if (previo.lock && previo.lock.pub && previo.lock.pub !== j.lock.pub) {
      console.error(`✗ ${ruta}: la llave de firma cambió respecto a ${base}. Solo el dueño original puede actualizar este archivo.`); errores++; continue;
    }
  } catch { /* archivo nuevo: no hay con qué comparar */ }
  const r = resumen(j, f);
  if (!r.reglas.ok) {   // el horario debe encajar con las reglas (jornada, cruces, festivos, apoyo, máx. 2 o 3 programas)
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
