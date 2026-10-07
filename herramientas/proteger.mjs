#!/usr/bin/env node
// Horario SENA · protección del HTML (por el Ing. Manuel Alejandro Ordóñez Hernández)
//
//   node herramientas/proteger.mjs entrada.html salida.html [--minificar] [--solo-minificar]
//
//   --minificar       reduce y ofusca ligeramente el JavaScript (dificulta leerlo, NO lo hace secreto)
//   --solo-minificar  entrega el HTML funcional sin cifrar (para publicarlo en Pages para los instructores)
//   (sin --solo-minificar) CIFRA el HTML con tu contraseña: sin ella la página solo muestra una
//                     ventana pidiendo la clave. Úsalo para tu copia maestra o para entregas controladas.
//
// La contraseña se pide por consola (o variable de entorno CLAVE). Nunca se guarda en el archivo.
// Cifrado: PBKDF2-SHA256 (600 000 iteraciones) + AES-256-GCM (WebCrypto).
import {readFileSync, writeFileSync} from 'node:fs';
import {webcrypto as crypto} from 'node:crypto';
import {createInterface} from 'node:readline';

const args = process.argv.slice(2), flags = args.filter(a => a.startsWith('--')), [src, dst] = args.filter(a => !a.startsWith('--'));
if (!src || !dst) { console.error('Uso: node herramientas/proteger.mjs entrada.html salida.html [--minificar] [--solo-minificar]'); process.exit(1); }
let html = readFileSync(src, 'utf8');
const AUTOR = 'Ing. Manuel Alejandro Ordóñez Hernández';

if (flags.includes('--minificar') || flags.includes('--solo-minificar')) {
  let terser;
  try { terser = await import('terser'); } catch { console.error('Falta terser. Ejecuta: npm install --no-save terser'); process.exit(1); }
  const partes = html.split(/(<script>[\s\S]*?<\/script>)/);
  for (let i = 0; i < partes.length; i++) {
    const m = partes[i].match(/^<script>([\s\S]*)<\/script>$/); if (!m) continue;
    const r = await terser.minify(m[1], {compress: {passes: 2}, mangle: true, format: {comments: false, preamble: `/*! Horario SENA · creado por el ${AUTOR} · © 2026 · Prohibida su copia sin autorización */`}});
    if (r.error) throw r.error;
    partes[i] = '<script>' + r.code + '</script>';
  }
  html = partes.join('');
  console.log('✓ JavaScript minificado');
}
if (flags.includes('--solo-minificar')) { writeFileSync(dst, html); console.log('✓', dst, (html.length / 1024).toFixed(0) + ' KB (sin cifrar)'); process.exit(0); }

const pedir = () => new Promise(res => {
  if (process.env.CLAVE) return res(process.env.CLAVE);
  const rl = createInterface({input: process.stdin, output: process.stdout});
  process.stdout.write('Contraseña para cifrar: ');
  rl.question('', v => { rl.close(); res(v); });
});
const clave = await pedir();
if (clave.length < 12) { console.error('Usa una contraseña de al menos 12 caracteres (mejor una frase).'); process.exit(1); }

const ITER = 600000, salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
const k = await crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, new TextEncoder().encode(html)));
const b64 = u => Buffer.from(u).toString('base64');

const cargador = `<!doctype html>
<!-- Horario SENA · creado por el ${AUTOR} · © 2026 · Contenido cifrado (AES-256-GCM). -->
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="author" content="Manuel Alejandro Ordóñez Hernández"><title>Horario SENA</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f2ec;color:#1c2530;font:15px/1.45 system-ui,sans-serif}
@media (prefers-color-scheme:dark){body{background:#11161c;color:#e8edf2}input{background:#192029!important;color:inherit}}
form{width:min(92vw,360px);display:grid;gap:12px;text-align:center}
h1{margin:0;font-size:22px}h1 span{color:#66727f;font-weight:400}
input,button{font:inherit;padding:11px 14px;border-radius:10px;border:1px solid #cfc8ba}
input{background:#fffdf9}button{background:#1c2530;color:#fffdf9;border-color:#1c2530;cursor:pointer}
button:disabled{opacity:.6}small{color:#66727f}#m{color:#c93c3c;min-height:1.3em;font-size:13px}
</style></head><body>
<form id="f"><h1>Horario <span>SENA</span></h1>
<small>Aplicación protegida. Escribe la contraseña de acceso.</small>
<input id="p" type="password" placeholder="Contraseña" autocomplete="current-password" autofocus>
<button id="b">Abrir</button><div id="m"></div>
<small>Creado por el ${AUTOR}</small></form>
<script>
const D={s:"${b64(salt)}",i:"${b64(iv)}",c:"${b64(ct)}",n:${ITER}};
const u=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
document.getElementById('f').addEventListener('submit',async e=>{
  e.preventDefault();const b=document.getElementById('b'),m=document.getElementById('m');m.textContent='';b.disabled=true;b.textContent='Abriendo…';
  try{
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(document.getElementById('p').value),'PBKDF2',false,['deriveKey']);
    const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:u(D.s),iterations:D.n,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
    const h=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:u(D.i)},k,u(D.c)));
    document.open();document.write(h);document.close();
  }catch(x){m.textContent='Contraseña incorrecta.';b.disabled=false;b.textContent='Abrir'}
});
</script></body></html>`;
writeFileSync(dst, cargador);
console.log('✓', dst, (cargador.length / 1024).toFixed(0) + ' KB · cifrado con tu contraseña');
