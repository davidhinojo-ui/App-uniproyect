# Auditoría de migración de UniProyect a Vercel

Estado: **PREPARACIÓN — NO DESPLEGAR**. Base: `main`, 3 de noviembre de 2026.

## Arquitectura actual (verificada en repositorio)
- React 19, Vite 6, TypeScript, Express (`server.ts`), Firebase Web SDK, Gemini.
- `npm run build` genera `dist` y compila servidor Express; `npm start` levanta un listener permanente.
- La SPA consume `/api/*` desde `src/services/api.ts`.
- `server.ts` inicia la sincronización desde Firestore al arrancar el proceso, sirve estáticos y realiza `app.listen()`.
- `workerPortalService.ts` utiliza arrays mutables de obras, trabajadores, registros, documentos y auditoría. La sincronización con Firestore es parcial; las escrituras también son parciales.
- Firestore se inicializa desde `firebase-applet-config.json` local cuando el archivo existe. La ausencia del archivo puede dejar la aplicación utilizando datos en memoria.

## BLOQUEOS DE PRODUCCIÓN (no conectar Vercel a `main` todavía)
1. **Persistencia**: convertir todos los CRUD de trabajadores, obras, fichajes, documentos, firmas, invitaciones y auditoría en operaciones duraderas de Firestore. No hacer depender una petición del estado en memoria de otra petición. Las aprobaciones de costes deben utilizar transacciones o mecanismos idempotentes.
2. **Datos personales**: los datos de ejemplo en `workerPortalService.ts` contienen información personal real o aparentemente real. Eliminar del código y sustituir por fixtures ficticios; comprobar exposición previa del repositorio e historial, y rotar credenciales si se han publicado. No copiar datos personales al entorno Preview.
3. **Autorización**: varios endpoints aceptan `workerId` del cliente y la API de supervisor carece de verificación centralizada de identidad/rol en `server.ts`. Implementar autenticación, autorización por organización/obra y límites de acceso a documentos/fichajes para todas las rutas; no inferir permisos del identificador recibido.
4. **Integración Firestore**: sustituir la inicialización dependiente de archivo local por configuración segura en runtime. Preferir Firebase Admin SDK para operaciones privilegiadas y reglas de autorización explícitas en backend. Mantener proyecto, base de datos y colecciones actuales sin migrar datos automáticamente.
5. **Runtime Vercel**: no usar `app.listen`, servidor permanente, disco persistente ni sincronización inicial en background como base del funcionamiento. Extraer la app Express a un módulo exportable; añadir adaptador `api/index.ts` y enrutamiento `/api/*` **solo después** de resolver los bloqueos anteriores.
6. **IA y archivos**: dos rutas Gemini (`/api/gemini/analyze` y `/api/gemini/analyze-structural-expense`) aceptan contenido de archivos. Medir tamaños máximos y duración; pasar archivos voluminosos a Storage + procesamiento asíncrono. Proteger claves por variables de entorno de servidor.
7. **Fiabilidad**: agregar pruebas de autenticación/aislamiento entre usuarios, fichaje desde instancias independientes, idempotencia en aprobación, invitación QR, firma de documentos, fallos de Firestore y reintentos.
8. **Coste y límites**: confirmar plan Vercel apropiado para uso comercial, región de funciones próxima a Firestore y límites de duración, payload y memoria según plan vigente.

## Ruta de implementación propuesta
- [x] Crear rama `migration/vercel` sin alterar `main`.
- [x] Documentar auditoría y riesgos de Vercel.
- [ ] Reemplazar datos personales embebidos por fixtures sintéticos sin perder datos reales existentes en Firestore.
- [ ] Introducir repositorios Firestore para obras, trabajadores, fichajes, documentos, invitaciones y auditoría.
- [ ] Introducir middleware de autenticación y autorización de roles/obras y pruebas de acceso.
- [ ] Separar Express de su arranque local (`app` exportada) y adaptar backend a Vercel Functions.
- [ ] Crear configuración Vercel: compilación estática Vite, rutas SPA, APIs dinámicas y variables.
- [ ] Ejecutar `npm ci`, `npm run lint`, `npm test`, `npm run build` y pruebas de integración.
- [ ] Revisar Preview en entorno Firebase aislado, sin copiar datos reales.
- [ ] Abrir PR, revisar; integrar en `main` y habilitar producción solo tras autorización explícita.

## Variables y conectividad
- `GEMINI_API_KEY`: **solo servidor**, requerida mientras se conserve la IA actual.
- Firebase: usar configuración cliente solo para SDK web; para operaciones privilegiadas usar identidad de servicio de backend en secretos/identidad federada. No poner credenciales privilegiadas en variables `VITE_*`.
- Separar `Preview` y `Production` en Vercel. Preview no debe escribir en el Firestore de producción.
- Revisar dominio autorizado de Firebase Auth, CORS, reglas de Storage y callback URLs antes del cambio de dominio.

## Criterio para considerar la migración lista
El mismo usuario puede registrar entradas y salidas, aprobar fichajes, consultar sus documentos y firmarlos en dos instancias independientes de la API sin inconsistencias; no se accede a datos de terceros; los endpoints devuelven errores controlados cuando falla Firestore; el OCR no expone claves; `npm test`, typecheck, build y smoke tests pasan en Preview.

**Este documento describe hallazgos en código; no constituye una auditoría de los datos ni credenciales reales del proyecto Firebase. No se ha realizado ningún despliegue.**
