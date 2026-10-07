// ../../../../../outputs/horario-sena-limpio/scripts/reglas.mjs
var RULES = { START: 6, END: 18 };
var TYPES = { formacion: "Formaci\xF3n", planeacion: "Planeaci\xF3n", seguimiento: "Seguimiento" };
var DAY = 864e5;
var pad = (n) => String(n).padStart(2, "0");
var parseKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m, d };
};
var utc = (k) => {
  const p = parseKey(k);
  return Date.UTC(p.y, p.m - 1, p.d);
};
var dow = (k) => new Date(utc(k)).getUTCDay();
var msKey = (ms) => new Date(ms).toISOString().slice(0, 10);
var fh = (h) => pad(h) + ":00";
function easterMs(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = (h + l - 7 * m + 114) % 31 + 1;
  return Date.UTC(y, mo - 1, da);
}
function toMonday(ms) {
  const w = new Date(ms).getUTCDay();
  return w === 1 ? ms : ms + (8 - w) % 7 * DAY;
}
var _hol = {};
function holidays(y) {
  if (_hol[y]) return _hol[y];
  const h = {};
  const add = (ms, n) => {
    h[msKey(ms)] = n;
  };
  const fx = (m, d, n) => add(Date.UTC(y, m - 1, d), n), mv = (m, d, n) => add(toMonday(Date.UTC(y, m - 1, d)), n);
  const e = easterMs(y);
  fx(1, 1, "A\xF1o Nuevo");
  mv(1, 6, "Reyes Magos");
  mv(3, 19, "San Jos\xE9");
  add(e - 3 * DAY, "Jueves Santo");
  add(e - 2 * DAY, "Viernes Santo");
  fx(5, 1, "D\xEDa del Trabajo");
  add(toMonday(e + 39 * DAY), "Ascensi\xF3n del Se\xF1or");
  add(toMonday(e + 60 * DAY), "Corpus Christi");
  add(toMonday(e + 68 * DAY), "Sagrado Coraz\xF3n");
  mv(6, 29, "San Pedro y San Pablo");
  fx(7, 20, "D\xEDa de la Independencia");
  fx(8, 7, "Batalla de Boyac\xE1");
  mv(8, 15, "Asunci\xF3n de la Virgen");
  mv(10, 12, "D\xEDa de la Raza");
  mv(11, 1, "Todos los Santos");
  mv(11, 11, "Independencia de Cartagena");
  fx(12, 8, "Inmaculada Concepci\xF3n");
  fx(12, 25, "Navidad");
  return _hol[y] = h;
}
function isWorkable(k) {
  const w = dow(k);
  if (w === 0) return { ok: false, reason: "Domingo" };
  if (w === 6) return { ok: false, reason: "S\xE1bado" };
  const hn = holidays(parseKey(k).y)[k];
  if (hn) return { ok: false, reason: hn, holiday: true };
  return { ok: true, reason: "" };
}
function limits(maxApoyo) {
  const per = Math.max(1, maxApoyo - 1);
  return { plan: per, seg: per, total: maxApoyo };
}
function validateBlock(b, day, maxApoyo = 2) {
  if (!TYPES[b.type]) return "Tipo de bloque no v\xE1lido.";
  if (!Number.isInteger(b.start) || !Number.isInteger(b.hours) || b.hours < 1) return "La hora de inicio y la duraci\xF3n deben ser n\xFAmeros enteros (m\xEDnimo 1 h).";
  if (b.start < RULES.START) return "Antes de las 06:00 no se programa (la jornada va de 6 a. m. a 6 p. m.).";
  if (b.start + b.hours > RULES.END) return "Termina despu\xE9s de las 18:00; la jornada va de 6 a. m. a 6 p. m.";
  if (b.type === "formacion" && !(b.comp && b.rap && b.ficha)) return "La formaci\xF3n necesita ficha, competencia y RAP.";
  for (const o of day) {
    if (b.start < o.start + o.hours && o.start < b.start + b.hours) return `Se cruza con otro bloque (${fh(o.start)}\u2013${fh(o.start + o.hours)}).`;
  }
  if (b.type !== "formacion") {
    const L = limits(maxApoyo);
    const same = day.filter((o) => o.type === b.type).reduce((s, o) => s + o.hours, 0);
    const apoyo = day.filter((o) => o.type !== "formacion").reduce((s, o) => s + o.hours, 0);
    const per = b.type === "planeacion" ? L.plan : L.seg;
    if (same + b.hours > per) return `M\xE1ximo ${per} h de ${TYPES[b.type].toLowerCase()} por d\xEDa.`;
    if (apoyo + b.hours > L.total) return `M\xE1ximo ${L.total} h de apoyo (planeaci\xF3n + seguimiento) por d\xEDa.`;
  }
  return null;
}
function gradoHoras(blocks, fichas) {
  const g = { "10": 0, "11": 0, "?": 0 }, p = {}, fm = {};
  for (const f of fichas) fm[f.id] = f;
  for (const b of blocks) {
    if (b.type !== "formacion") continue;
    const f = fm[b.ficha], gr = f && (f.grado === "10" || f.grado === "11") ? f.grado : "?", pg = f && f.programa ? f.programa : "?";
    g[gr] += b.hours;
    (p[pg] = p[pg] || { "10": 0, "11": 0, "?": 0 })[gr] += b.hours;
  }
  return { g, p };
}
function auditar(blocks, o) {
  const out = [], byDay = {};
  for (const b of blocks) (byDay[b.date] = byDay[b.date] || []).push(b);
  for (const d of Object.keys(byDay).sort()) {
    const w = isWorkable(d);
    if (!w.ok) {
      out.push(`${d}: ${w.holiday ? "festivo (" + w.reason + ")" : w.reason.toLowerCase()}, no se programa.`);
      continue;
    }
    const acc = [];
    for (const b of byDay[d].slice().sort((a, c) => a.start - c.start)) {
      const e = validateBlock(b, acc, o.maxApoyo || 2);
      if (e) out.push(`${d} ${Number.isInteger(b.start) ? fh(b.start) : "?"}: ${e}`);
      else acc.push(b);
    }
  }
  const np = o.nProgramas || 0, mp = o.maxProgramas || 2;
  if (mp !== 2 && mp !== 3) out.push("El m\xE1ximo de programas de formaci\xF3n debe ser 2 o 3.");
  else if (np > mp) out.push(`Tiene ${np} programas de formaci\xF3n y el m\xE1ximo es ${mp}.`);
  if (np > 0 && o.fichas) {
    const used = new Set(blocks.filter((b) => b.type === "formacion" && b.ficha).map((b) => b.ficha));
    o.fichas.forEach((f, i) => {
      if (used.has(f.id) && !f.programa) out.push(`La ficha ${i + 1} tiene horas de formaci\xF3n pero no tiene programa asignado.`);
    });
  }
  return out;
}

// ../../../../../outputs/horario-sena-limpio/scripts/nucleo.mjs
var canon = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).filter((k) => v[k] !== void 0).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
};
var unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
var huellaWeb = async (pubB64) => {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", unb64(pubB64)));
  return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
};
async function verificar(j) {
  try {
    const l = j && j.lock;
    if (!l || !l.pub || !l.sig) return { estado: "sin-sello", ok: false, motivo: "El archivo no est\xE1 sellado" };
    const cuerpo = { ...j };
    delete cuerpo.lock;
    delete cuerpo.exported;
    const pub = await crypto.subtle.importKey("spki", unb64(l.pub), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, unb64(l.sig), new TextEncoder().encode(canon(cuerpo)));
    const huella = await huellaWeb(l.pub);
    return ok ? { estado: "valido", ok: true, huella } : { estado: "roto", ok: false, motivo: "El contenido no coincide con la firma (fue modificado)", huella };
  } catch (e) {
    return { estado: "roto", ok: false, motivo: "Sello ilegible" };
  }
}
function resumen(j, archivo) {
  const t = { formacion: 0, planeacion: 0, seguimiento: 0 }, dias = /* @__PURE__ */ new Set(), meses = /* @__PURE__ */ new Set();
  const blocks = Array.isArray(j.blocks) ? j.blocks : [];
  const cat = j.catalog || {}, p = j.profile || {}, st = j.settings || {};
  for (const b of blocks) {
    if (t[b.type] === void 0 || !Number.isInteger(b.hours) || typeof b.date !== "string") continue;
    t[b.type] += b.hours;
    dias.add(b.date);
    meses.add(b.date.slice(0, 7));
  }
  const fchs = (cat.fichas || []).map((f) => ({ id: f.n, grado: f.grado, programa: f.programa || null }));
  const G = gradoHoras(blocks, fchs);
  const horasFicha = {};
  for (const b of blocks) if (b.type === "formacion" && b.ficha) horasFicha[b.ficha] = (horasFicha[b.ficha] || 0) + b.hours;
  const fichas = (cat.fichas || []).map((f) => ({ n: f.n, nombre: f.name, grado: f.grado === "11" ? "11" : "10", programa: f.programa || null, horas: horasFicha[f.n] || 0 }));
  const hp = (id) => G.p[id] || { "10": 0, "11": 0, "?": 0 };
  const programas = (cat.programas || []).map((x) => ({ n: x.n, nombre: x.name, h10: hp(x.n)["10"], h11: hp(x.n)["11"], hSin: hp(x.n)["?"], total: hp(x.n)["10"] + hp(x.n)["11"] + hp(x.n)["?"] }));
  if (G.p["?"]) programas.push({ n: null, nombre: "Sin programa", h10: G.p["?"]["10"], h11: G.p["?"]["11"], hSin: G.p["?"]["?"], total: G.p["?"]["10"] + G.p["?"]["11"] + G.p["?"]["?"] });
  const maxProg = st.maxProgramas === 3 ? 3 : 2;
  const problemas = auditar(blocks, { maxApoyo: st.maxApoyo === 3 ? 3 : 2, nProgramas: (cat.programas || []).length, maxProgramas: st.maxProgramas ?? 2, fichas: fchs });
  return {
    archivo,
    nombre: p.name || "(sin nombre)",
    cargo: p.cargo || "",
    centro: p.centro || "",
    programas,
    maxProgramas: maxProg,
    fichas,
    competencias: (cat.comps || []).length,
    raps: (cat.raps || []).length,
    grados: { "10": G.g["10"], "11": G.g["11"], sin: G.g["?"] },
    horas: { ...t, total: t.formacion + t.planeacion + t.seguimiento },
    dias: dias.size,
    meses: [...meses].sort(),
    reglas: { ok: problemas.length === 0, problemas },
    selladoEn: j.lock && j.lock.at || "",
    huellaDeclarada: j.lock && j.lock.fp || "",
    autor: j.author || ""
  };
}

// ../../../../../outputs/horario-sena-limpio/servidor/worker.js
var MAX_BYTES = 2 * 1024 * 1024;
var slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "instructor";
var b64 = (s) => {
  const u = new TextEncoder().encode(s);
  let t = "";
  for (let i = 0; i < u.length; i += 32768) t += String.fromCharCode(...u.subarray(i, i + 32768));
  return btoa(t);
};
var unb642 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
var iguales = (a, b) => {
  a = String(a || "");
  b = String(b || "");
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};
var worker_default = {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ORIGEN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method === "GET") return out(200, { ok: true, servicio: "Horario SENA \xB7 env\xEDos", requiereCodigo: !!env.CODIGO });
    if (req.method !== "POST") return out(405, { ok: false, error: "M\xE9todo no permitido" });
    if (env.ORIGEN && env.ORIGEN !== "*" && req.headers.get("Origin") && req.headers.get("Origin") !== env.ORIGEN)
      return out(403, { ok: false, error: "Este env\xEDo no viene del sitio autorizado." });
    const texto = await req.text();
    if (texto.length > MAX_BYTES) return out(413, { ok: false, error: "El archivo es demasiado grande (m\xE1x. 2 MB). Quita o reduce la foto." });
    let cuerpo;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      return out(400, { ok: false, error: "Env\xEDo ilegible." });
    }
    if (env.CODIGO && !iguales(cuerpo.codigo, env.CODIGO)) return out(401, { ok: false, error: "C\xF3digo de env\xEDo incorrecto. P\xEDdeselo al administrador." });
    const j = cuerpo.doc;
    if (!j || j.app !== "horario-sena" || !Array.isArray(j.blocks)) return out(400, { ok: false, error: "No es un archivo de Horario SENA." });
    const v = await verificar(j);
    if (!v.ok) return out(422, { ok: false, error: "Sello inv\xE1lido: " + v.motivo + ". Sella tu horario y vuelve a enviarlo." });
    const r = resumen(j, "");
    if (!r.reglas.ok) return out(422, { ok: false, error: "El horario no cumple las reglas.", problemas: r.reglas.problemas.slice(0, 10) });
    const archivo = `${slug(j.profile && j.profile.name)}-${v.huella.replace(/\s/g, "").slice(0, 6).toLowerCase()}.json`;
    const ruta = `horarios/${archivo}`;
    const api = `https://api.github.com/repos/${env.REPO}/contents/${ruta}`;
    const gh = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "horario-sena-envios", "X-GitHub-Api-Version": "2022-11-28" };
    const rama = env.RAMA || "main";
    let sha, put;
    for (let intento = 0; intento < 5; intento++) {
      if (intento) await new Promise((r2) => setTimeout(r2, 300 + Math.random() * 900 * intento));
      sha = void 0;
      const previo = await fetch(`${api}?ref=${encodeURIComponent(rama)}`, { headers: gh });
      if (previo.status === 200) {
        const p = await previo.json();
        sha = p.sha;
        try {
          const anterior = JSON.parse(unb642(p.content));
          const nuevoAt = Date.parse(j.lock.at), viejoAt = Date.parse(anterior.lock && anterior.lock.at);
          if (anterior.lock && anterior.lock.pub !== j.lock.pub) return out(409, { ok: false, error: "Ya existe un archivo con ese nombre firmado con otra llave." });
          if (viejoAt && nuevoAt && nuevoAt <= viejoAt) return out(409, { ok: false, error: "El servidor ya tiene una versi\xF3n igual o m\xE1s reciente de tu horario." });
        } catch {
        }
      } else if (previo.status !== 404) return out(502, { ok: false, error: "No se pudo consultar el repositorio (" + previo.status + ")." });
      put = await fetch(api, {
        method: "PUT",
        headers: { ...gh, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Env\xEDo: ${j.profile.name || archivo} \xB7 huella ${v.huella}${sha ? " (actualizaci\xF3n)" : " (nuevo)"}`,
          content: b64(JSON.stringify(j, null, 2) + "\n"),
          branch: rama,
          ...sha ? { sha } : {}
        })
      });
      if (put.status !== 409 && put.status !== 422 && put.status < 500) break;
    }
    if (!put.ok) return out(502, { ok: false, error: "No se pudo guardar en el repositorio (" + put.status + "). Avisa al administrador." });
    return out(200, { ok: true, archivo, nuevo: !sha, huella: v.huella, mensaje: sha ? "Horario actualizado." : "Horario recibido." });
  }
};
export {
  worker_default as default
};
