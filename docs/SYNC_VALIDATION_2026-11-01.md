# UniProyect — sincronización y validación · 01/11/2026

## Origen comprobado

- Repositorio único: `davidhinojo-ui/App-uniproyect`.
- Base revisada: `f3981d9db2e1bf1f3c37f9b95d99a07f5c7adf67` (`main`).
- Exportación aportada: `uniproyect (1).zip`, SHA-256 `00301ca4f456b2f81b7c51311f14a77a0ed6080085b73ceeb2c7b97cfe2c49fa`.
- Comparación binaria de **42 archivos** (59 entradas contando directorios): todos coinciden con los mismos archivos en `main`. Se conservan también los archivos de GitHub ausentes del ZIP. No hay archivos nuevos ni diferencias de AI Studio que importar.
- `50d11cc` no está en las referencias descargadas. El ZIP no contiene historial Git para demostrar su relación con ese commit. Se acredita igualdad de contenido, no identidad de commits.
- Vista Guiada/Completa, Acciones Rápidas Guiadas y Control Horario ya están en la base. No se sustituye la aplicación por paquetes anteriores.
- No se ha recibido un segundo ZIP visual en este turno; estos ajustes se aplican sobre el código actual verificado.

## Cambios preparados

- Paleta de botones con contraste mínimo 4,5:1 para texto blanco en reposo y hover, ambos temas. Se preservan iconos y textos anidados de navegación activa.
- Banner guiado claro en modo diurno, colores legibles para estados, etiquetas secundarias nocturnas y acentos morado/celeste.
- Reserva de espacio inferior y desplazamiento del selector de tema sobre la barra del portal, incluyendo safe areas.
- Área común de cabecera, navegación y contenido hasta 2200 px; trabajadores en cuatro columnas desde 1600 px; seis acciones guiadas en una fila desde 2400 px. Los puntos de cambio móvil/tablet existentes se conservan.
- Cabeceras de control horario apilables en móvil; cabecera principal en columna hasta disponer de espacio para sus controles.
- Acciones guiadas convertidas en botones nativos, estados ARIA de selección, foco visible y reducción de movimiento.
- Lock npm reparado; npm es la vía validada. `bun.lock` se conserva, sin certificar instalación con Bun.
- `npm start` ejecuta el servidor compilado sin Vite; escucha `PORT` y `0.0.0.0`.
- Versión candidata `1.0.1`, manifiesto público `dist/version.json` con versión, commit y estado de cambios. No contiene variables de entorno ni credenciales. Si no hay Git ni `APP_BUILD_SHA`, el commit se declara desconocido.
- CI propuesta de instalación limpia, TypeScript, build y tests, con permiso de solo lectura de contenido y sin despliegue.

## Pruebas locales

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Correcta tras reparar lock | Instalación limpia local; CI ejecutará npm ci con scripts normales |
| `npm run lint` | Correcta | TypeScript del proyecto |
| `npm run build` | Correcta | Vite, dos salidas esbuild y manifiesto |
| `npm test` | 23/23 correctas | 19 pruebas de paleta, una de marcado accesible y tres de servidor de producción |
| `git diff --check` | Correcta | Formato de cambios |
| Renderizado visual local | Bloqueado | El navegador remoto no alcanza el servidor local; conexión rechazada |
| iPhone/Android/iPad/ultrapanorámico | Pendiente | No se certifica comportamiento visual ni de dispositivos físicos |

Los tests de paleta calculan luminancia WCAG de los colores declarados en CSS y sus superficies previstas. **No son una auditoría del contraste de todo el DOM renderizado**, transparencias, estados deshabilitados, hover de tarjetas ni de todas las combinaciones heredadas. La prueba de botones comprueba el marcado estático; no sustituye pruebas de interacción en navegador. Las pruebas HTTP no modifican datos.

## Bloqueos importantes de producción (ya presentes en main)

1. `server.ts` registra las rutas de supervisor directamente, sin middleware de autenticación/autorización. Una petición local a `/api/supervisor/workers`, sin credenciales, devuelve HTTP 200 y contiene registros con el campo PIN. Solo se registraron el estado y la existencia del campo; no se publican valores.
2. `src/server/workerPortalService.ts` utiliza arrays mutables en memoria para trabajadores, proyectos, fichajes y documentos. Reiniciar o escalar instancias no preserva ni coordina los cambios. No está acreditada una base persistente detrás de estas rutas.
3. La validación visual responsive de la rama sigue pendiente.

Estos hallazgos impiden considerar la aplicación lista para producción. Se mantiene el PR en borrador y no se fusiona ni despliega. Reparar autenticación y persistencia exige conectar el entorno y modelo de identidades/datos reales, conservando datos existentes; no se inventan credenciales ni se despliegan reglas de acceso a ciegas.

## Publicación observada

URL consultada: `https://uniproyect-112691093407.europe-west2.run.app/`.

- `/`: HTTP 200, HTML; referencias `/assets/index-Bumxjkpg.js` y `/assets/index-BztCj8YN.css`.
- `/api/health`: HTTP 200, JSON.
- `/version.json`: HTTP 200 **con HTML de la SPA**, no manifiesto. No identifica una versión publicada.
- Los assets locales de esta rama tienen otros nombres. No se ha publicado esta rama ni se atribuye al despliegue un SHA de GitHub.
- No se han consultado endpoints públicos de personal ni ejecutado operaciones de datos sobre producción.

## Continuación y criterios de integración

1. Resolver y probar autenticación/autorización del supervisor y persistencia con el entorno real.
2. Obtener vista previa aislada de la rama; probar ambos temas, guiada/completa y portal en 320, 390, 768, 820, 1024, 1440, 1920, 2560 y 3440 px, con orientación y zoom. Comprobar foco, hover, scroll horizontal limitado a tablas/pestañas, navegación inferior y selector sin solapamientos, QR y fichaje sin envíos duplicados.
3. Confirmar CI del HEAD exacto. Revisar `main` nuevamente antes de integrar. El PR #4 sigue separado: su ampliación de ancho queda contemplada en esta propuesta, pero no se cierra ni fusiona automáticamente.
4. Tras validación y fusión, actualizar AI Studio desde **Settings → GitHub → Pull** del repositorio y rama correctos. Verificar el SHA y volver a exportar para contrastar contenido; resolver conflictos por archivo. El enlace aportado abre la vista compartida con Remix y no acredita acceso al editor original. No se crea una copia Remix ni se modifica otro proyecto.
5. Revisar configuración existente del servicio Cloud Run, identidad de despliegue, almacenamiento, variables y revisiones sin imprimir secretos. Se requiere acceso autenticado al proyecto original; no hay CLI gcloud instalada en este entorno.
6. Construir con `npm ci`, `npm run lint`, `npm run build`, `npm test`. Usar el SHA validado para `APP_BUILD_SHA` si el entorno compila desde ZIP sin Git. El manifiesto declara `dirty: null` si no puede comprobar el árbol.
7. Publicar en el servicio existente desde AI Studio o el mecanismo de Cloud Run ya configurado; conservar la revisión anterior para vuelta atrás. No se ha demostrado que fusionar GitHub active despliegue automático.
8. Verificar **la URL real**: salud, HTML, assets y `/version.json` como JSON con el commit esperado, además de rutas y flujos de usuario. HTTP 200 por sí solo no confirma versión.

Fuentes oficiales comprobadas para el procedimiento:

- https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- https://docs.cloud.google.com/run/docs/container-contract
- https://docs.cloud.google.com/run/docs/deploying-source-code
