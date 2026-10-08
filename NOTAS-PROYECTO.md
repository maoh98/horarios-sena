# Horario SENA · notas del proyecto (versión 4, 2026-10-08)

Autor: Ing. Manuel Alejandro Ordóñez Hernández

## Dónde está publicado
- Planificador: https://maoh98.github.io/horarios-sena/
- Panel admin:  https://maoh98.github.io/horarios-sena/admin.html
- Repo (público): https://github.com/maoh98/horarios-sena
- Worker de envíos (Cloudflare): https://horario-sena-envios.maordonezh.workers.dev  · código de envío: sena2026
- El token de GitHub está guardado SOLO como secreto en Cloudflare (vence 7-oct-2027). No va en archivos.

## Qué trae la versión 2
- Jornada 6 a. m. – 10 p. m. (reloj de 24 h) · máx. 3 programas · fichas sin límite (con buscador)
- Institución por ficha: tipo (Académica 11 h / Técnica 5 h / Privada 2 h, solo informativo) + lista + "Otra institución…"
- Panel admin con filtros por tipo/institución y horas por tipo en porcentaje
- Archivos sellados anteriores siguen siendo válidos (schema 1); al volver a sellar pasan a schema 2

## Novedades de la versión 4 (modo administrador)
- El administrador crea su llave (index.html?admin), publica `horarios/administrador.json` y desde entonces puede abrir/corregir cualquier horario sellado y crear horarios completos para instructores. Ver README → «Modo administrador».
- Cada sello lleva `lock.adm` (llave de firma cifrada para el administrador), `rev` (versión, solo sube), `por` (instructor/administrador) y `file` (nombre fijo del archivo).
- Orden de despliegue: Cloudflare (worker-unico.js) y luego GitHub (index.html, admin.html, scripts/, servidor/, README).
- La copia de seguridad de la llave de administrador (`NO-SUBIR-llave-privada-administrador.json`) y su contraseña NO están en el repositorio ni se pueden recuperar.

## Archivo fuente editable
`horario-sena.html` (bloque // <LOGIC> = reglas e INSTITUCIONES). Para cambiar algo:
1. editar horario-sena.html
2. node herramientas/sincronizar-reglas.mjs horario-sena.html
3. npm install --no-save terser && node herramientas/proteger.mjs horario-sena.html index.html --solo-minificar
4. npx esbuild servidor/worker.js --bundle --format=esm --outfile=servidor/worker-unico.js  → pegar en Cloudflare (Editar código → Deploy)
5. subir index.html, admin.html, scripts/, servidor/ al repo
(Orden al publicar: primero Cloudflare, luego GitHub.)

## Pendientes
- Probar envíos realmente simultáneos de varios instructores
- Vista compacta del admin si hay muchos instructores
