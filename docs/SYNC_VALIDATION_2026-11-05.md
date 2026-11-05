# Sincronización del ZIP «uniproyect (ok)» — 05/11/2026

## Origen y comparación

- Repositorio: `davidhinojo-ui/App-uniproyect`, base `f54e90a06adc1e068314038ffa2dc6dc673d0c16` de `main`.
- ZIP adjunto recuperado desde la conversación original; `/mnt/data` no existe en este equipo Windows.
- SHA-256 del ZIP: `e6ee60f0fad479470d81fc28c4a36f7ffe4bb682c758a2ae5deab96d3e89e298`.
- Sus 88 archivos coinciden con los del repositorio al normalizar CRLF/LF. No hay archivos nuevos ni cambios de contenido que importar. Se conservan todos los archivos adicionales del repositorio.
- Vista Guiada/Completa, las seis Acciones Rápidas Guiadas y Control Horario ya están incorporados en esta base. No se sustituye código por versiones anteriores.
- La copia local `uniproyect-2` pertenece a otro repositorio y otra cuenta. No se han trasladado sus cambios de Supabase a este repositorio.

## Correcciones propuestas

- Control Horario rechaza con HTTP 409 entradas repetidas, salidas sin entrada abierta, salidas repetidas y salidas de otra obra. La validación se realiza antes de modificar la memoria o intentar escribir fichajes.
- El cálculo usa la duración transcurrida: no inventa ocho horas sin entrada ni un mínimo de seis minutos. Se mantiene el límite previo de 14 horas. Los fichajes históricos no se alteran.
- El servicio compilado incluye su nuevo módulo de validación y declara formato ESM, coherente con el proyecto.
- Las pruebas de contraste normalizan finales de línea para funcionar también en Windows.
- Las pruebas HTTP ejecutan el servidor desde una carpeta temporal con los assets compilados, sin configuración Firebase ni archivo `.env` del proyecto. No consultan ni escriben la base real.

## Integraciones y límites

- **Firebase:** existe integración de gestión con Auth/Firestore. El servicio del portal usa el SDK cliente desde el servidor sin sesión Firebase acreditada, combina datos en memoria con lecturas de `plantillaTrabajadores`/`obras` y algunas escrituras en `fichajes`/`personal`. No restaura el historial de fichajes al arrancar. Las invitaciones, PIN y auditoría siguen dependiendo de memoria. No se certifica persistencia entre reinicios o instancias.
- **Seguridad:** rutas de supervisor sin middleware de autorización; los tokens del portal no ofrecen verificación de sesión efectiva en las rutas. Las reglas versionadas permiten acceso público a múltiples colecciones y contienen permisos duplicados que anulan restricciones más estrictas. Además, el propietario puede modificar su propio rol en `users`. Véase `FIRESTORE_AUDIT_2026-11-05.json`. No se han desplegado reglas ni comprobado las reglas activas del servicio publicado.
- **Supabase:** no hay cliente, dependencia ni configuración de Supabase en esta base o ZIP. La integración de otro repositorio no acredita una integración aquí. No se han inventado credenciales ni migrado datos.
- **OpenAI:** no aparece SDK ni endpoint OpenAI. El servidor utiliza `@google/genai` y `GEMINI_API_KEY`. No se ha probado una llamada de pago ni añadido otro proveedor.
- La protección contra fichajes duplicados propuesta cubre el historial disponible en una instancia. No sustituye transacciones, autenticación, persistencia compartida ni recuperación del historial tras reiniciar.
- Auditoría npm: 19 avisos (2 críticos, 11 altos, 5 moderados, 1 bajo). Algunas soluciones automáticas proponen retroceder Firebase/ExcelJS a versiones incompatibles; no se ha ejecutado `audit fix --force`. La corrección de dependencias requiere validación independiente de documentos, exportaciones y Firestore.
- Build advierte de un fragmento frontend de más de 3 MB. Pendiente validación visual y de interacción en navegador/dispositivos, y pruebas reales de proveedores en entorno aislado.

## Validación y publicación

Validación local completada: `npm ci --no-audit --no-fund`, TypeScript (`npm run lint`), compilación completa (`npm run build`), 37/37 pruebas (`npm test`) y `git diff --check`. Node 24 y npm 10.9.4 local. La compilación se ejecutó con acceso normal de Windows tras un error EPERM del entorno restringido. CI del commit remoto se verifica por separado en el PR.

La rama y el PR son de revisión. No se fusiona `main`, no se despliega la aplicación, no se modifican datos remotos, configuración de proveedores ni reglas activas. El workflow versionado solo instala, comprueba TypeScript, compila y prueba; no contiene despliegue. Los riesgos de autorización y persistencia impiden considerar esta rama lista para producción.
