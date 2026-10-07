# Horario SENA · repositorio de horarios sellados

Creado por el **Ing. Manuel Alejandro Ordóñez Hernández** · © 2026

Un archivo `.json` por instructor, firmado digitalmente, guardado en Git. Cualquiera puede **verlo**; solo el instructor (con su contraseña) puede **modificarlo**, y Git conserva toda la historia.

```
index.html            el planeador (lo que usan los instructores)
admin.html            panel del administrador/auditor
horarios/             AQUÍ van los archivos de los instructores (uno por persona)
scripts/              verificación de sellos y de reglas + generador del Excel/índice
  reglas.mjs          reglas del planeador (generado, no editar a mano)
servidor/             worker.js + wrangler.toml: recibe envíos SIN cuenta de GitHub (Cloudflare, gratis)
herramientas/         proteger.mjs (cifrar / minificar) · sincronizar-reglas.mjs
.github/workflows/    verificación automática y publicación en GitHub Pages
```

## Flujo del instructor
1. Abre el sitio (`index.html`), llena perfil, **programas de formación** (2 o máximo 3; se elige el máximo en el perfil), fichas (10°/11°, cada una asignada a su programa), competencias y RAP, y programa sus horas.
2. Pulsa **Sellar horario**. Antes de sellar el planeador revisa que todo encaje (6 a. m.–6 p. m., sin cruces, sin festivos, límites de apoyo, máx. de programas y fichas con programa); si algo no encaja, lo marca y no deja sellar. Luego crea su contraseña (mín. 10 caracteres; mejor una frase). El horario queda estático.
3. Pulsa el candado → **Descargar archivo (.json)**.
4. Pulsa **📤 Enviar mi horario** (sin cuenta de nada; ver «Envío sin cuenta» abajo). Alternativas: descargar el `.json` y mandarlo al administrador, o —solo quien tenga GitHub— subirlo a `horarios/`. En el mismo cuadro del candado hay accesos directos: **⬆ Subir mi archivo**, **📁 Abrir la carpeta** y **👁 Ver mi horario publicado** (aparecen solos si el sitio está en GitHub Pages; si no, escribe `usuario/repo` en la etiqueta `sena-repo` de `index.html`). Nómbralo igual que la vez anterior (p. ej. `maria-perez.json`) para que reemplace al anterior y Git conserve la historia.
5. Para cambiar algo: abre su archivo con *Exportar / Importar → Abrir un archivo sellado* → **Usar como mi archivo** → **Desbloquear** (contraseña) → edita → **Sellar de nuevo** → descarga y sube la nueva versión. Cada versión queda en el historial de Git.

### ¿El instructor necesita cuenta de GitHub? **No.**
- Usar el planeador, sellar, enviar y ver horarios: sin ninguna cuenta. Lo único que necesita es el enlace del sitio y, si lo pones, el *código de envío*.
- El botón **📤 Enviar mi horario** manda el archivo sellado a un pequeño servidor (`servidor/worker.js`) que lo **verifica** y lo guarda en `horarios/`. Si el servidor no está configurado, la app muestra un correo de respaldo (`sena-correo`) para enviar el `.json` adjunto.
- Quien sí tenga GitHub puede seguir subiéndolo él mismo (botones dentro de «Solo para quien tiene cuenta de GitHub»).

### Envío sin cuenta (10 min, una sola vez, lo hace el administrador)
1. Crea una cuenta gratuita en Cloudflare. En tu equipo: `cd servidor && npx wrangler login`.
2. Edita `servidor/wrangler.toml`: `REPO` (usuario/repositorio), `ORIGEN` (`https://usuario.github.io`) y, si quieres, `CODIGO` (clave de grupo que entregas a los instructores; frena envíos de desconocidos, no es un secreto fuerte).
3. En GitHub crea un **token de acceso fino** (Settings → Developer settings → Fine-grained tokens): solo ese repositorio, permiso **Contents: Read and write**. Guárdalo con `npx wrangler secret put GITHUB_TOKEN`.
4. `npx wrangler deploy` → te entrega una dirección `https://horario-sena-envios.<cuenta>.workers.dev`.
5. Pégala en `index.html`, etiqueta `<meta name="sena-envio" content="...">` (y, si quieres, un correo en `sena-correo`). Haz commit.
6. Si proteges `main` con Pull Request obligatorio, permite que **tu usuario** (dueño del token) pueda saltarse la regla, o el servidor no podrá guardar.

### Montarlo desde el celular (sin computador)
Cloudflare se puede hacer completo desde el navegador del celular, sin instalar nada: Workers y Pages → Crear → *Hello World* → **Editar código** → pega todo `servidor/worker-unico.js` (es el mismo servidor en un solo archivo) → Desplegar. Luego *Configuración → Variables y secretos*: agrega `REPO`, `RAMA`, `ORIGEN`, `CODIGO` (texto) y `GITHUB_TOKEN` (tipo **Secreto**). Usa la vista «Sitio de escritorio» del navegador. Si cambias las reglas del planeador, vuelve a generar `worker-unico.js` (`npx esbuild servidor/worker.js --bundle --format=esm --outfile=servidor/worker-unico.js`) y pégalo de nuevo.

**Qué hace el servidor antes de guardar:** verifica la firma, las reglas (6–18 h, cruces, festivos, apoyo, 2/3 programas), rechaza versiones más viejas que la guardada y decide él mismo el nombre del archivo (`nombre-huella.json`), de modo que **un envío nunca puede reemplazar el archivo de otra persona**. Tras guardar, el chequeo de Git y Pages republican solos y el panel admin lo muestra en ~1–2 minutos.

**Límites que debes conocer:** cualquiera con el enlace puede *intentar* enviar (por eso el código de grupo y el límite de 2 MB); un archivo falso pero bien firmado por un desconocido entraría como «un instructor más» — el panel lo mostrará con otro nombre/huella y puedes borrarlo en Git. Si el código se filtra, cámbialo en `wrangler.toml` y `npx wrangler deploy`. Para limitar abusos activa una regla de *Rate limiting* gratuita en Cloudflare. Esto no lo pude probar contra Cloudflare ni GitHub reales: probé el servidor con GitHub simulado.

## Flujo del administrador
- Abre `https://<usuario>.github.io/<repo>/admin.html`.
  - **Lista de instructores:** cuántos son, de quién es cada archivo, programas y fichas, **horas de grado 10° y 11°** (por instructor y por programa), horas totales, estado del sello y si el horario *encaja* con las reglas. **Clic en un nombre** → abre su planeador en modo consulta (solo lectura, con el sello verificado).
  - **Horario de todos:** una sola tabla con todos los instructores del mes; cada día muestra sus horas separadas por 10°, 11°, planeación y seguimiento. Clic en un día → sus bloques; clic en el nombre → su planeador en ese mes.
- El panel **se actualiza solo cada minuto** (y al volver a la pestaña): si GitHub publicó un envío nuevo, la lista y el «Horario de todos» se refrescan sin recargar. También hay un botón **Actualizar**. Entre que el instructor envía y GitHub publica pasan ~1–2 minutos.
- **Descargar Excel / CSV** desde el mismo panel (hojas: Instructores, Programas y grados, Horas por día del mes, Resumen) (o `npm run indice`, que genera `instructores.xlsx` y `instructores.csv`).
- Sin conexión: en el panel, carga varios `.json` a mano.

## Puesta en marcha (15 min)
1. Crea el repositorio y sube todo esto. En *Settings → Pages* elige **Source: GitHub Actions**.
2. En *Settings → Branches* protege `main`: exige Pull Request, revisión de *Code Owners* y que pase el chequeo **Verificar sellos**.
3. Edita `.github/CODEOWNERS`: pon tu usuario como dueño de `index.html`, `scripts/` y `.github/`, y a cada instructor como dueño de su archivo.
4. Cuando suba el primer instructor, borra `horarios/.gitkeep` (opcional).

## Qué garantiza el sello (y qué no)
- **Sí:** si alguien cambia una sola hora, el nombre o el historial dentro del archivo, la firma deja de coincidir → *Sello roto* en el panel y el chequeo de Git rechaza el cambio. Solo quien tiene la contraseña puede volver a sellar.
- **Sí:** el chequeo de Git también revisa las **reglas** del horario (jornada, cruces, festivos, límites de apoyo, máx. 2 o 3 programas): un archivo firmado pero que no encaje se rechaza.
- **Sí:** el chequeo fija la **llave pública** de cada instructor (la de la rama base): nadie puede reemplazar un archivo por otro firmado con una llave distinta.
- **No:** bloquear la edición dentro del navegador no es una barrera absoluta (es una página web); la garantía real es la firma + Git + permisos del repositorio. Por eso el panel y el CI verifican la firma, no la pantalla.
- La contraseña protege la llave de firma que viaja cifrada dentro del archivo. Si el repo es público, una contraseña corta podría adivinarse por fuerza bruta: usa frases largas, o usa un repositorio privado.
- Si un instructor pierde su contraseña no se recupera; habría que crear un nuevo sello y aprobarlo a mano (el chequeo marcará el cambio de llave).

## Proteger tu autoría y el código
- Tu nombre aparece de forma discreta en: pie del panel izquierdo, ayuda del logo, metadatos del HTML, comentarios del código, consola del navegador, archivos `.json` (campo `author`, **firmado**: si lo borran, el sello se rompe) y Excel (propiedades + hoja Resumen).
- `node herramientas/proteger.mjs index.html salida.html --solo-minificar` → versión reducida/ofuscada para publicar (necesita `npm install --no-save terser`).
- `node herramientas/proteger.mjs index.html salida.html --minificar` → además **cifra** el HTML con tu contraseña (AES-256-GCM). Sin la clave solo se ve una ventana de acceso. Úsalo para tu copia maestra o entregas controladas.
- Límite honesto: una página que los instructores abren en su navegador **tiene que descifrarse en su navegador**; quien tenga la clave (o abra el sitio ya descifrado) puede copiar el código. Ofuscar y cifrar eleva el esfuerzo, no lo hace imposible. Lo que sí te respalda: la autoría firmada dentro de los archivos, el historial de Git a tu nombre, una licencia (agrega un archivo `LICENSE` con "Todos los derechos reservados") y mantener el código fuente en un repositorio privado.

## Mantenimiento (solo el autor)
Las reglas viven en `horario-sena.html` (la copia legible, bloque `LOGIC`). Si las cambias:
1. `node herramientas/sincronizar-reglas.mjs ruta/a/horario-sena.html` (actualiza `scripts/reglas.mjs` y `admin.html`).
2. `node herramientas/proteger.mjs ruta/a/horario-sena.html index.html --solo-minificar` (regenera la versión publicada).
Así el planeador, el panel y Git aplican siempre exactamente las mismas reglas.
