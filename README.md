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
1. Abre el sitio (`index.html`), llena perfil, **programas de formación** (máximo 3), fichas **sin límite** (10°/11°, cada una asignada a su programa y a su **institución educativa**: se elige el tipo —Académica, Técnica o Privada— y luego la institución en la lista, o «+ Otra institución…»), competencias y RAP, y programa sus horas.
2. Pulsa **Sellar horario**. Antes de sellar el planeador revisa que todo encaje (6 a. m.–10 p. m., sin cruces, sin festivos, límites de apoyo, máx. de programas, y fichas con programa e institución); si algo no encaja, lo marca y no deja sellar. Luego crea su contraseña (mín. 10 caracteres; mejor una frase). El horario queda estático.
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

**Qué hace el servidor antes de guardar:** verifica la firma, las reglas (6–22 h, cruces, festivos, apoyo, máx. 3 programas, institución en cada ficha con horas), rechaza versiones más viejas que la guardada y decide él mismo el nombre del archivo (`nombre-huella.json`), de modo que **un envío nunca puede reemplazar el archivo de otra persona**. Tras guardar, el chequeo de Git y Pages republican solos y el panel admin lo muestra en ~1–2 minutos.

**Límites que debes conocer:** cualquiera con el enlace puede *intentar* enviar (por eso el código de grupo y el límite de 2 MB); un archivo falso pero bien firmado por un desconocido entraría como «un instructor más» — el panel lo mostrará con otro nombre/huella y puedes borrarlo en Git. Si el código se filtra, cámbialo en `wrangler.toml` y `npx wrangler deploy`. Para limitar abusos activa una regla de *Rate limiting* gratuita en Cloudflare. Esto no lo pude probar contra Cloudflare ni GitHub reales: probé el servidor con GitHub simulado.

## Flujo del administrador
- Abre `https://<usuario>.github.io/<repo>/admin.html`.
  - **Lista de instructores:** cuántos son, de quién es cada archivo, programas y fichas, **horas de grado 10° y 11°** (por instructor y por programa), horas totales, estado del sello y si el horario *encaja* con las reglas. **Clic en un nombre** → abre su planeador en modo consulta (solo lectura, con el sello verificado).
  - **Horario de todos:** una sola tabla con todos los instructores del mes; cada día muestra sus horas separadas por 10°, 11°, planeación y seguimiento. Clic en un día → sus bloques; clic en el nombre → su planeador en ese mes.
- El panel **se actualiza solo cada minuto** (y al volver a la pestaña): si GitHub publicó un envío nuevo, la lista y el «Horario de todos» se refrescan sin recargar. También hay un botón **Actualizar**. Entre que el instructor envía y GitHub publica pasan ~1–2 minutos.
- **Descargar Excel / CSV** desde el mismo panel (hojas: Instructores, Programas y grados, Horas por día del mes, Resumen) (o `npm run indice`, que genera `instructores.xlsx` y `instructores.csv`).
- Sin conexión: en el panel, carga varios `.json` a mano.

## Modo administrador: corregir horarios y crear el de un instructor

**Idea:** cada sello lleva, además, una copia de la llave de firma del instructor **cifrada para el administrador**. Con su propia llave (protegida por su contraseña) el administrador abre cualquier horario, lo corrige y lo vuelve a sellar **con la firma del instructor**. Así el archivo conserva el mismo nombre, la misma huella y el mismo dueño; no hace falta tocar las reglas del servidor ni el chequeo de Git. Cada versión queda numerada y marcada como *«corregido por el administrador»*, y el historial de Git guarda las anteriores.

### Preparación (una sola vez)
1. Sube esta versión (ver «Actualizar» abajo) y abre `https://<usuario>.github.io/<repo>/index.html?admin` (o el botón **🔑 Mi llave** del panel).
2. Escribe tu nombre y una contraseña larga (mínimo 10 caracteres) → **Crear llave**. Se descarga `llave-administrador-horario-sena.json`: **guárdala en un lugar seguro** (copia en la nube y en una memoria). Sin ella y sin la contraseña no podrás abrir los horarios ya sellados.
3. En la misma ventana pulsa **Descargar administrador.json** y súbelo a la carpeta `horarios/` del repositorio (*Add file → Upload files*). Es solo tu llave **pública**; el chequeo de Git y los instructores la usan para preparar la copia cifrada. Cuando esté publicada, la ventana dirá «✓ Tu llave está publicada».
4. En otro computador: abre el mismo enlace → **Importar** el archivo de la llave → escribe la contraseña.

### Corregir un horario existente
- En el panel, botón **✏ Editar** en la fila del instructor (o *Administrador → Corregir un horario*). Escribes tu contraseña, el planeador abre ese horario **en modo administrador** (franja morada), editas con las mismas herramientas del instructor y pulsas **Enviar** → *Sellar y enviar*. Tu propio horario guardado en el navegador **no se toca**.
- Si ya tenías un borrador sin terminar, al volver a entrar aparece «Retomar / Descartar».
- Solo se pueden abrir los horarios sellados **después** de publicar tu llave. Los anteriores aparecen como «sin acceso de administrador»: pídele al instructor que los abra con su contraseña y los selle otra vez (con un clic queda disponible para ti).

### Crear el horario completo de un instructor
- Panel → **➕ Horario nuevo** (o *Administrador → Crear horario nuevo para un instructor*). Escribes el nombre y armas programas, fichas (con institución o SENA/especialidad), competencias, RAP y calendario.
- Al sellar eliges una **contraseña para el instructor** (hay un botón *Sugerir una*). Se envía y se muestra una sola vez: entrégasela por un medio seguro. Con ella el instructor abre el archivo en su planeador (*Exportar / Importar* → «Abrir un archivo sellado» → **Usar como mi archivo** → **Desbloquear**; o simplemente abre su enlace publicado `index.html?ver=horarios/<archivo>`) y puede seguir editándolo; tú siempre puedes abrirlo con tu llave.
- ¿Olvidó la contraseña? Abre su horario en modo administrador y, al sellar, escribe una nueva en «Cambiar la contraseña del instructor».

### Si el administrador y el instructor editan a la vez
Cada sello lleva un número de **versión** y el servidor solo acepta versiones mayores. Si el instructor tiene una copia vieja y la envía, recibe el aviso *«El servidor ya tiene la versión N, corregida por el administrador»*; al abrir el planeador aparece la franja **«Hay una versión más reciente… [Cargar esa versión]»**. Carga la nueva, edita y vuelve a enviar. El nombre del archivo queda fijo (campo firmado `file`), así que corregir el nombre del instructor no crea un duplicado.

### Seguridad: qué significa que el administrador pueda abrir los horarios
- Quien tenga tu llave **y** tu contraseña puede firmar como cualquier instructor que se haya sellado con ella. Trátala como la llave del repositorio: contraseña larga y copia de seguridad guardada.
- Un instructor solo puede modificar su propio archivo (su contraseña); el administrador, cualquiera. Todo cambio queda en el historial de Git (autor del commit: el servidor de envíos) y en el campo firmado `por` («administrador») y en el historial interno del horario.
- Si cambias de llave de administrador, los horarios sellados con la anterior dejan de abrirse con la nueva hasta que el instructor los vuelva a sellar. No la cambies sin necesidad.

## Puesta en marcha (15 min)
1. Crea el repositorio y sube todo esto. En *Settings → Pages* elige **Source: GitHub Actions**.
2. En *Settings → Branches* protege `main`: exige Pull Request, revisión de *Code Owners* y que pase el chequeo **Verificar sellos**.
3. Edita `.github/CODEOWNERS`: pon tu usuario como dueño de `index.html`, `scripts/` y `.github/`, y a cada instructor como dueño de su archivo.
4. Cuando suba el primer instructor, borra `horarios/.gitkeep` (opcional).

## Qué garantiza el sello (y qué no)
- **Sí:** si alguien cambia una sola hora, el nombre o el historial dentro del archivo, la firma deja de coincidir → *Sello roto* en el panel y el chequeo de Git rechaza el cambio. Solo quien tiene la contraseña puede volver a sellar.
- **Sí:** el chequeo de Git también revisa las **reglas** del horario (jornada, cruces, festivos, límites de apoyo, máx. 3 programas): un archivo firmado pero que no encaje se rechaza.
- **Sí:** el chequeo fija la **llave pública** de cada instructor (la de la rama base): nadie puede reemplazar un archivo por otro firmado con una llave distinta.
- **No:** bloquear la edición dentro del navegador no es una barrera absoluta (es una página web); la garantía real es la firma + Git + permisos del repositorio. Por eso el panel y el CI verifican la firma, no la pantalla.
- La contraseña protege la llave de firma que viaja cifrada dentro del archivo. Si el repo es público, una contraseña corta podría adivinarse por fuerza bruta: usa frases largas, o usa un repositorio privado.
- Si un instructor pierde su contraseña, **el administrador puede ponerle otra** desde el modo administrador (ver abajo). Sin llave de administrador no se recupera.

## Proteger tu autoría y el código
- Tu nombre aparece de forma discreta en: pie del panel izquierdo, ayuda del logo, metadatos del HTML, comentarios del código, consola del navegador, archivos `.json` (campo `author`, **firmado**: si lo borran, el sello se rompe) y Excel (propiedades + hoja Resumen).
- `node herramientas/proteger.mjs index.html salida.html --solo-minificar` → versión reducida/ofuscada para publicar (necesita `npm install --no-save terser`).
- `node herramientas/proteger.mjs index.html salida.html --minificar` → además **cifra** el HTML con tu contraseña (AES-256-GCM). Sin la clave solo se ve una ventana de acceso. Úsalo para tu copia maestra o entregas controladas.
- Límite honesto: una página que los instructores abren en su navegador **tiene que descifrarse en su navegador**; quien tenga la clave (o abra el sitio ya descifrado) puede copiar el código. Ofuscar y cifrar eleva el esfuerzo, no lo hace imposible. Lo que sí te respalda: la autoría firmada dentro de los archivos, el historial de Git a tu nombre, una licencia (agrega un archivo `LICENSE` con "Todos los derechos reservados") y mantener el código fuente en un repositorio privado.

## Mantenimiento (solo el autor)
## Instituciones educativas

La lista oficial (con su tipo A/T/P) está en `horario-sena.html`, bloque `LOGIC`, constante `INSTITUCIONES`; las horas informativas de cada tipo (11, 5 y 2) están en `TIPOS_INST` (solo se muestran, no validan nada). Si un instructor escribe una institución que no está en la lista, queda marcada **«nueva»** en el panel del administrador (también hay filtro por tipo, por institución y por «nuevas»). Para volverla oficial: agrega una línea a `INSTITUCIONES` y haz los pasos de abajo.

Los horarios sellados antes de esta versión (sin institución) siguen siendo válidos; cuando su dueño los desbloquee y vuelva a sellar, el planeador le pedirá la institución de cada ficha con horas.

## Cambiar las reglas

Las reglas viven en `horario-sena.html` (la copia legible, bloque `LOGIC`, está en la raíz del repositorio). Si las cambias:
1. `node herramientas/sincronizar-reglas.mjs ruta/a/horario-sena.html` (actualiza `scripts/reglas.mjs` y `admin.html`).
2. `node herramientas/proteger.mjs ruta/a/horario-sena.html index.html --solo-minificar` (regenera la versión publicada).
3. `npx esbuild servidor/worker.js --bundle --format=esm --outfile=servidor/worker-unico.js` y pega el resultado en Cloudflare (Editar código → Desplegar).
Así el planeador, el panel y Git aplican siempre exactamente las mismas reglas.
