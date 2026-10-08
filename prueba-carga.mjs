// Horario SENA · prueba de carga del Worker (envíos simultáneos)
// Crea N instructores FALSOS ("Prueba Carga 001"…), los sella y los envía todos a la vez.
// Uso:  node prueba-carga.mjs 20            (20 envíos simultáneos)
//       node prueba-carga.mjs 20 5          (20 envíos en tandas de 5)
// Los archivos quedan en horarios/ con nombre "prueba-carga-…": bórralos después (ver instrucciones).
import {webcrypto as crypto} from 'node:crypto';

const URL_ = 'https://horario-sena-envios.maordonezh.workers.dev';
const CODIGO = 'sena2026';
const ORIGEN = 'https://maoh98.github.io';
const N = +process.argv[2] || 10, TANDA = +process.argv[3] || N;

const canon = v => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
};
const b64 = u => Buffer.from(u).toString('base64');

async function documento(i) {
  const par = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const pub = b64(new Uint8Array(await crypto.subtle.exportKey('spki', par.publicKey)));
  const nombre = `Prueba Carga ${String(i).padStart(3, '0')}`;
  const cuerpo = {
    schema: 2, app: 'horario-sena', author: 'Prueba de carga',
    profile: {name: nombre, cargo: 'prueba', centro: 'prueba', photo: ''},
    settings: {maxApoyo: 2, maxProgramas: 3},
    catalog: {
      comps: [{n: 1, name: 'Competencia de prueba', phva: 'H'}],
      raps: [{n: 1, name: 'RAP de prueba', comp: 1, nc: 1}],
      fichas: [{n: 1, name: String(3000000 + i), grado: '10', programa: 1, tipo: 'A', inst: 'I.E. San Pedro Claver'}],
      programas: [{n: 1, name: 'Programa de prueba'}]
    },
    blocks: [{date: '2026-10-13', start: 8 + (i % 10), hours: 2, type: 'formacion', comp: 1, rap: 1, ficha: 1}],
    log: []
  };
  const sig = b64(new Uint8Array(await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, par.privateKey, new TextEncoder().encode(canon(cuerpo)))));
  return {...cuerpo, lock: {v: 1, alg: 'ECDSA-P256-SHA256', pub, fp: '', kdf: {}, iv: '', key: '', sig, at: new Date().toISOString()}};
}

async function enviar(i) {
  const t0 = Date.now();
  try {
    const r = await fetch(URL_, {method: 'POST', headers: {'Content-Type': 'text/plain', Origin: ORIGEN}, body: JSON.stringify({codigo: CODIGO, doc: await documento(i)})});
    const j = await r.json().catch(() => ({}));
    return {i, status: r.status, ok: !!j.ok, ms: Date.now() - t0, error: j.error || ''};
  } catch (e) { return {i, status: 0, ok: false, ms: Date.now() - t0, error: String(e.message || e)}; }
}

console.log(`Enviando ${N} horarios (de ${TANDA} en ${TANDA})…`);
const t0 = Date.now(), res = [];
for (let k = 1; k <= N; k += TANDA) {
  const lote = []; for (let i = k; i < k + TANDA && i <= N; i++) lote.push(enviar(i));
  res.push(...await Promise.all(lote));
}
const bien = res.filter(r => r.ok), mal = res.filter(r => !r.ok), ms = res.map(r => r.ms).sort((a, b) => a - b);
console.log(`\nResultado: ${bien.length} guardados, ${mal.length} con error · total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`Tiempo por envío: mediana ${ms[Math.floor(ms.length / 2)]} ms · máximo ${ms[ms.length - 1]} ms`);
mal.slice(0, 10).forEach(r => console.log(`  ✗ #${r.i} (${r.status}) ${r.error}`));
console.log('\nSiguiente: espera 1-2 min, abre el panel y confirma que aparecen', bien.length, 'instructores de prueba.');
