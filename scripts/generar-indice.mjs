#!/usr/bin/env node
// Genera el índice de instructores para el panel del administrador y el Excel/CSV.
// Uso: node scripts/generar-indice.mjs [carpeta=horarios] [salida=.]
//   horarios/index.json        → lo lee admin.html
//   <salida>/instructores.csv  → siempre
//   <salida>/instructores.xlsx → si está instalada la dependencia "xlsx" (npm install)
import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {archivos, leer, verificar, resumen} from './lib.mjs';
import {ESPECIALIDADES} from './reglas.mjs';
const gt = f => f.grado === '10' || f.grado === '11' ? f.grado + '°' : f.grado === 'E' ? (ESPECIALIDADES[f.esp] || 'Especialidad') : 'Sin grado';

const dir = process.argv[2] || 'horarios', salida = process.argv[3] || '.';
mkdirSync(salida, {recursive: true});
const lista = [];
for (const f of archivos(dir)) {
  let j; try { j = leer(dir, f); } catch { continue; }
  if (j.app !== 'horario-sena') continue;
  const v = await verificar(j);
  lista.push({...resumen(j, f), estado: v.estado, huella: v.huella || '', motivo: v.motivo || ''});
}
lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
lista.forEach((x, i) => x.n = i + 1);
writeFileSync(join(dir, 'index.json'), JSON.stringify({generado: new Date().toISOString(), total: lista.length, instructores: lista}, null, 2));

const COLS = ['N°', 'Instructor', 'Cargo', 'Centro', 'Programas de formación', 'N° programas', 'Fichas', 'Instituciones', 'Horas grado 10°', 'Horas grado 11°', 'Horas formación', 'Horas planeación', 'Horas seguimiento', 'Horas totales', 'Días programados', 'Meses', 'Revisión de reglas', 'Estado del sello', 'Sellado el (UTC)', 'Huella', 'Archivo'];
const ESTADO = {valido: 'Sellado y verificado', roto: 'SELLO ROTO', 'sin-sello': 'Sin sellar'};
const TN = {A: 'Académica', T: 'Técnica', P: 'Privada', S: 'SENA'};
const progNombres = x => x.programas.filter(p => p.n).map(p => `P${p.n}. ${p.nombre}`).join(' | ');
const filas = lista.map(x => [x.n, x.nombre, x.cargo, x.centro, progNombres(x), x.programas.filter(p => p.n).length, x.fichas.map(f => `${f.nombre} (${gt(f)}${f.programa ? ' · P' + f.programa : ''}${f.inst ? ' · ' + (TN[f.tipo] || '?') + ': ' + f.inst : ''})`).join(' | '),
  x.instituciones.filter(i => i.nombre !== 'Sin institución').map(i => `${TN[i.tipo] || '?'}: ${i.nombre}${i.nueva ? ' (nueva)' : ''}`).join(' | '),
  x.grados['10'], x.grados['11'], x.horas.formacion, x.horas.planeacion, x.horas.seguimiento, x.horas.total, x.dias, x.meses.join(', '),
  x.reglas.ok ? 'Encaja' : `${x.reglas.problemas.length} problema(s): ${x.reglas.problemas.slice(0, 3).join(' / ')}`,
  ESTADO[x.estado] || x.estado, x.selladoEn ? x.selladoEn.slice(0, 16).replace('T', ' ') : '', x.huella, `${dir}/${x.archivo}`]);
const COLS_P = ['Instructor', 'N° programa', 'Programa de formación', 'Horas grado 10°', 'Horas grado 11°', 'Horas especialidad / sin grado', 'Horas totales'];
const COLS_I = ['Instructor', 'Tipo de institución', 'Institución', 'Nueva (fuera de la lista oficial)', 'N° fichas', 'Horas de formación'];
const filasI = lista.flatMap(x => x.instituciones.map(i => [x.nombre, TN[i.tipo] || '', i.nombre, i.nueva ? 'Sí' : '', i.fichas, i.horas]));
const filasP = lista.flatMap(x => x.programas.map(p => [x.nombre, p.n ?? '', p.nombre, p.h10, p.h11, p.hSin, p.total]));
const seguro = v => typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;   // evita fórmulas en Excel
const csvCel = v => { const s = String(seguro(v) ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
writeFileSync(join(salida, 'instructores.csv'), '\ufeff' + [COLS, ...filas].map(r => r.map(csvCel).join(';')).join('\r\n'));

const tot = k => lista.reduce((s, x) => s + x.horas[k], 0), totG = g => lista.reduce((s, x) => s + x.grados[g], 0);
const resumenHoja = [['Indicador', 'Valor'], ['Total de instructores', lista.length], ['Sellados y verificados', lista.filter(x => x.estado === 'valido').length], ['Con sello roto', lista.filter(x => x.estado === 'roto').length], ['Sin sellar', lista.filter(x => x.estado === 'sin-sello').length],
  ['Horarios que no encajan con las reglas', lista.filter(x => !x.reglas.ok).length],
  ['Instituciones nuevas por revisar', new Set(lista.flatMap(x => x.fichas.filter(f => f.instNueva).map(f => f.inst))).size],
  ['Horas de formación grado 10°', totG('10')], ['Horas de formación grado 11°', totG('11')], ['Horas de formación especialidad / sin grado', totG('sin')],
  ['Horas de formación', tot('formacion')], ['Horas de planeación', tot('planeacion')], ['Horas de seguimiento', tot('seguimiento')], ['Horas totales', tot('total')], ['Generado', new Date().toISOString().slice(0, 16).replace('T', ' ')], ['Creado por', 'Ing. Manuel Alejandro Ordóñez Hernández · Horario SENA']];
try {
  const X = (await import('xlsx')).default;
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet([COLS, ...filas.map(r => r.map(seguro))]);
  ws['!cols'] = [5, 32, 26, 24, 50, 9, 56, 50, 10, 10, 10, 10, 10, 10, 10, 20, 34, 20, 17, 21, 36].map(w => ({wch: w}));
  X.utils.book_append_sheet(wb, ws, 'Instructores');
  const wp = X.utils.aoa_to_sheet([COLS_P, ...filasP.map(r => r.map(seguro))]); wp['!cols'] = [32, 11, 50, 12, 12, 12, 12].map(w => ({wch: w}));
  X.utils.book_append_sheet(wb, wp, 'Programas y grados');
  const wi = X.utils.aoa_to_sheet([COLS_I, ...filasI.map(r => r.map(seguro))]); wi['!cols'] = [32, 16, 44, 16, 10, 16].map(w => ({wch: w}));
  X.utils.book_append_sheet(wb, wi, 'Instituciones');
  const w2 = X.utils.aoa_to_sheet(resumenHoja); w2['!cols'] = [{wch: 28}, {wch: 52}];
  X.utils.book_append_sheet(wb, w2, 'Resumen');
  wb.Props = {Title: 'Instructores · Horario SENA', Author: 'Manuel Alejandro Ordóñez Hernández', Company: 'SENA'};
  X.writeFile(wb, join(salida, 'instructores.xlsx'));
  console.log('✓ instructores.xlsx');
} catch (e) { console.warn('! Sin instructores.xlsx (ejecuta "npm install" para habilitarlo):', e.code || e.message); }
console.log(`✓ ${lista.length} instructor(es) → ${join(dir, 'index.json')}, ${join(salida, 'instructores.csv')}`);
