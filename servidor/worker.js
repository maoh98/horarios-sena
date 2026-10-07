// Horario SENA · servidor de envíos (Cloudflare Workers, plan gratuito)
// Creado por el Ing. Manuel Alejandro Ordóñez Hernández · © 2026
//
// Permite que un instructor ENVÍE su horario sellado SIN tener cuenta de GitHub.
// El servidor no confía en nadie: antes de guardar, verifica LO MISMO que el chequeo de Git:
//   1) que el archivo esté sellado y la firma coincida (nadie lo alteró);
//   2) que el horario cumpla las reglas (6–18 h, sin cruces, sin festivos, apoyo, máx. 2 o 3 programas);
//   3) que no sea una versión más vieja que la ya guardada (evita volver atrás);
//   4) que el nombre del archivo lo decida el servidor (nombre + huella de la llave): un envío NUNCA
//      puede reemplazar el archivo de otra persona.
// Guarda con un "commit" en el repositorio usando un token que solo vive aquí (secreto del Worker).
//
// Variables (ver README → "Envío sin cuenta"):
//   REPO            "usuario/repositorio"
//   RAMA            "main"
//   ORIGEN          "https://usuario.github.io"   (de dónde se aceptan envíos; "*" para cualquiera)
//   CODIGO          (opcional) código de grupo que el administrador entrega a los instructores
//   GITHUB_TOKEN    (SECRETO) token con permiso "Contents: write" SOLO sobre ese repositorio
import {verificar, resumen} from '../scripts/nucleo.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'instructor';
const b64 = s => { const u = new TextEncoder().encode(s); let t = ''; for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(t); };
const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
const iguales = (a, b) => { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ORIGEN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    const out = (status, obj) => new Response(JSON.stringify(obj), {status, headers: {...cors, 'Content-Type': 'application/json; charset=utf-8'}});
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (req.method === 'GET') return out(200, {ok: true, servicio: 'Horario SENA · envíos', requiereCodigo: !!env.CODIGO});
    if (req.method !== 'POST') return out(405, {ok: false, error: 'Método no permitido'});
    if (env.ORIGEN && env.ORIGEN !== '*' && req.headers.get('Origin') && req.headers.get('Origin') !== env.ORIGEN)
      return out(403, {ok: false, error: 'Este envío no viene del sitio autorizado.'});

    const texto = await req.text();
    if (texto.length > MAX_BYTES) return out(413, {ok: false, error: 'El archivo es demasiado grande (máx. 2 MB). Quita o reduce la foto.'});
    let cuerpo; try { cuerpo = JSON.parse(texto); } catch { return out(400, {ok: false, error: 'Envío ilegible.'}); }
    if (env.CODIGO && !iguales(cuerpo.codigo, env.CODIGO)) return out(401, {ok: false, error: 'Código de envío incorrecto. Pídeselo al administrador.'});
    const j = cuerpo.doc;
    if (!j || j.app !== 'horario-sena' || !Array.isArray(j.blocks)) return out(400, {ok: false, error: 'No es un archivo de Horario SENA.'});

    const v = await verificar(j);
    if (!v.ok) return out(422, {ok: false, error: 'Sello inválido: ' + v.motivo + '. Sella tu horario y vuelve a enviarlo.'});
    const r = resumen(j, '');
    if (!r.reglas.ok) return out(422, {ok: false, error: 'El horario no cumple las reglas.', problemas: r.reglas.problemas.slice(0, 10)});

    const archivo = `${slug(j.profile && j.profile.name)}-${v.huella.replace(/\s/g, '').slice(0, 6).toLowerCase()}.json`;
    const ruta = `horarios/${archivo}`;
    const api = `https://api.github.com/repos/${env.REPO}/contents/${ruta}`;
    const gh = {Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'horario-sena-envios', 'X-GitHub-Api-Version': '2022-11-28'};
    const rama = env.RAMA || 'main';

    let sha, put;
    /* varios instructores pueden enviar a la vez: si GitHub responde conflicto, se reintenta */
    for (let intento = 0; intento < 5; intento++) {
      if (intento) await new Promise(r => setTimeout(r, 300 + Math.random() * 900 * intento));
      sha = undefined;
    const previo = await fetch(`${api}?ref=${encodeURIComponent(rama)}`, {headers: gh});
    if (previo.status === 200) {
      const p = await previo.json(); sha = p.sha;
      try {
        const anterior = JSON.parse(unb64(p.content));
        const nuevoAt = Date.parse(j.lock.at), viejoAt = Date.parse(anterior.lock && anterior.lock.at);
        if (anterior.lock && anterior.lock.pub !== j.lock.pub) return out(409, {ok: false, error: 'Ya existe un archivo con ese nombre firmado con otra llave.'});
        if (viejoAt && nuevoAt && nuevoAt <= viejoAt) return out(409, {ok: false, error: 'El servidor ya tiene una versión igual o más reciente de tu horario.'});
      } catch { /* si el anterior no se puede leer, se reemplaza */ }
    } else if (previo.status !== 404) return out(502, {ok: false, error: 'No se pudo consultar el repositorio (' + previo.status + ').'});

    put = await fetch(api, {
      method: 'PUT', headers: {...gh, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        message: `Envío: ${j.profile.name || archivo} · huella ${v.huella}${sha ? ' (actualización)' : ' (nuevo)'}`,
        content: b64(JSON.stringify(j, null, 2) + '\n'), branch: rama, ...(sha ? {sha} : {})
      })
    });
      if (put.status !== 409 && put.status !== 422 && put.status < 500) break;
    }
    if (!put.ok) return out(502, {ok: false, error: 'No se pudo guardar en el repositorio (' + put.status + '). Avisa al administrador.'});
    return out(200, {ok: true, archivo, nuevo: !sha, huella: v.huella, mensaje: sha ? 'Horario actualizado.' : 'Horario recibido.'});
  }
};
