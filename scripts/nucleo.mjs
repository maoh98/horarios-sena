// Horario SENA · núcleo de verificación SIN dependencias de Node (sirve en Node 18+ y en Cloudflare Workers)
// Creado por el Ing. Manuel Alejandro Ordóñez Hernández
import {gradoHoras, auditar, instFija, tipoValido, ESPECIALIDADES, espValida, apoyoValido} from './reglas.mjs';

export const canon = v => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
};
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const huellaWeb = async pubB64 => {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', unb64(pubB64)));
  return [...h.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');
};

/** Verifica el sello de un archivo de instructor. Mismo algoritmo que la app. */
export async function verificar(j) {
  try {
    const l = j && j.lock;
    if (!l || !l.pub || !l.sig) return {estado: 'sin-sello', ok: false, motivo: 'El archivo no está sellado'};
    const cuerpo = {...j}; delete cuerpo.lock; delete cuerpo.exported;
    const pub = await crypto.subtle.importKey('spki', unb64(l.pub), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
    const ok = await crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, pub, unb64(l.sig), new TextEncoder().encode(canon(cuerpo)));
    const huella = await huellaWeb(l.pub);
    return ok ? {estado: 'valido', ok: true, huella} : {estado: 'roto', ok: false, motivo: 'El contenido no coincide con la firma (fue modificado)', huella};
  } catch (e) { return {estado: 'roto', ok: false, motivo: 'Sello ilegible'}; }
}

/** Resumen de un archivo para el panel del administrador y el Excel. */
export function resumen(j, archivo) {
  const t = {formacion: 0, planeacion: 0, seguimiento: 0}, dias = new Set(), meses = new Set();
  const blocks = Array.isArray(j.blocks) ? j.blocks : [];
  const cat = j.catalog || {}, p = j.profile || {}, st = j.settings || {};
  for (const b of blocks) {
    if (t[b.type] === undefined || !Number.isInteger(b.hours) || typeof b.date !== 'string') continue;
    t[b.type] += b.hours; dias.add(b.date); meses.add(b.date.slice(0, 7));
  }
  const fchs = (cat.fichas || []).map(f => ({id: f.n, grado: f.grado, programa: f.programa || null, tipo: f.tipo, inst: f.inst, grado: f.grado, esp: f.esp}));
  const G = gradoHoras(blocks, fchs);
  const horasFicha = {};
  for (const b of blocks) if (b.type === 'formacion' && b.ficha) horasFicha[b.ficha] = (horasFicha[b.ficha] || 0) + b.hours;
  const fichas = (cat.fichas || []).map(f => ({
    n: f.n, nombre: f.name, grado: f.grado === '11' ? '11' : f.grado === 'E' ? 'E' : (f.grado === '' || f.grado === null) ? '' : '10',
    esp: f.grado === 'E' && espValida(f.esp) ? f.esp : null, programa: f.programa || null,
    tipo: tipoValido(f.tipo) ? f.tipo : null, inst: typeof f.inst === 'string' ? f.inst : '',
    instNueva: !!f.inst && !instFija(f.inst), horas: horasFicha[f.n] || 0
  }));
  // horas de formación por institución (para el panel y el Excel)
  const porInst = {};
  for (const f of fichas) {
    const k = f.inst ? `${f.tipo || '?'}|${f.inst}` : '?|';
    (porInst[k] = porInst[k] || {tipo: f.tipo, nombre: f.inst || 'Sin institución', nueva: f.instNueva, fichas: 0, horas: 0});
    porInst[k].fichas++; porInst[k].horas += f.horas;
  }
  const instituciones = Object.values(porInst).sort((a, b) => b.horas - a.horas);
  const hp = id => G.p[id] || {'10': 0, '11': 0, '?': 0};
  const programas = (cat.programas || []).map(x => ({n: x.n, nombre: x.name, h10: hp(x.n)['10'], h11: hp(x.n)['11'], hSin: hp(x.n)['?'], total: hp(x.n)['10'] + hp(x.n)['11'] + hp(x.n)['?']}));
  if (G.p['?']) programas.push({n: null, nombre: 'Sin programa', h10: G.p['?']['10'], h11: G.p['?']['11'], hSin: G.p['?']['?'], total: G.p['?']['10'] + G.p['?']['11'] + G.p['?']['?']});
  const maxProg = st.maxProgramas === 2 ? 2 : 3;
  const problemas = auditar(blocks, {maxApoyo: apoyoValido(st.maxApoyo), nProgramas: (cat.programas || []).length, maxProgramas: st.maxProgramas ?? 3, fichas: fchs, schema: j.schema || 1});
  return {
    archivo, nombre: p.name || '(sin nombre)', cargo: p.cargo || '', centro: p.centro || '',
    programas, maxProgramas: maxProg, fichas, instituciones, competencias: (cat.comps || []).length, raps: (cat.raps || []).length,
    grados: {'10': G.g['10'], '11': G.g['11'], sin: G.g['?']},
    horas: {...t, total: t.formacion + t.planeacion + t.seguimiento}, dias: dias.size, meses: [...meses].sort(),
    reglas: {ok: problemas.length === 0, problemas},
    selladoEn: (j.lock && j.lock.at) || '', huellaDeclarada: (j.lock && j.lock.fp) || '', autor: j.author || '',
    /* versión del horario y quién lo selló por última vez; adm = huella del administrador que puede abrirlo ('' si ninguno) */
    rev: Number.isInteger(j.rev) && j.rev > 0 ? j.rev : 0, por: j.por === 'administrador' ? 'administrador' : 'instructor',
    adm: (j.lock && j.lock.adm && typeof j.lock.adm.fp === 'string' && j.lock.adm.fp) || ''
  };
}
