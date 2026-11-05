# Réplica de UniProyect para Vercel y Supabase

Preparación del 5 de noviembre de 2026. No se ha desplegado, fusionado ni modificado la aplicación publicada.

## Qué se conserva

Se parte de los mismos 88 archivos del ZIP «uniproyect (ok)», iguales a `main` en `f54e90a`, y de la corrección de jornadas del PR de sincronización. Se mantienen las pantallas, estilos, temas, obras, gastos, personal, documentos, OCR local, análisis Gemini, exportaciones PDF/Excel, copias, Gmail/Drive, Vista Guiada/Completa, seis Acciones Rápidas, QR y Control Horario. Se añade una pantalla de acceso para proteger los datos. No se afirma que todos los proveedores estén ya configurados o validados con cuentas reales.

La capa de compatibilidad conserva las formas de los documentos y los identificadores anteriores. Los nombres `firebase.ts`, `setDoc`, `onSnapshot` y `firebaseAuthUid` se conservan en algunos adaptadores/campos por compatibilidad; el recorrido de la réplica usa Supabase y no inicializa Firebase. El código original de servidor permanece como referencia y no es el punto de entrada de Vercel ni de los comandos por defecto.

## Arquitectura y base de datos

- Proyecto elegido por el propietario: `uniproyect-2` (`byczwnknarrnoiaoqyxa`).
- Organización ya existente: `c2ff363b-a812-4b2f-887c-618941e47cff`.
- Migración aplicada: `20261105065621 / uniproyect_replica_documents_and_durable_portal`, SQL fuente en `supabase/schema/replica.sql`.
- No se sustituyen las once tablas anteriores ni los perfiles existentes.
- `up_replica_documents`: documentos JSONB conservando todos los campos de las nueve colecciones de gestión. Su clave incluye organización, colección e identificador. RLS comprueba perfil y rol de administrador/supervisor; los permisos no dependen de metadatos editables del usuario.
- `up_replica_portal`: estado del portal persistido en Postgres. Sin acceso para `anon` ni `authenticated`; solo backend. RLS sin políticas es intencionado aquí, no un acceso abierto.
- Las mutaciones del portal usan un estado por petición y control de revisión optimista en una función transaccional. Consumo de invitaciones, fichajes, aprobación, costes y cambios de documentos se confirman juntos; un conflicto provoca recarga y reintento. La respuesta no confirma éxito antes del commit.
- Sesiones de operario aleatorias, hash SHA-256 en base de datos, caducidad de 12 horas y revocación al desactivar el portal. PIN con scrypt y sal. Cinco intentos fallidos de acceso por identificador bloquean quince minutos.
- Las consultas de gestión paginan de 500 en 500. Las suscripciones consultan al cambiar la sesión o guardar, y cada quince segundos para otros dispositivos; no son listeners de Firebase ni WebSockets de Supabase.
- Esta estrategia prioriza fidelidad del documento original. El estado global del portal por organización serializa escrituras; antes de alto volumen conviene normalizar sesiones/jornadas y medir contención y crecimiento.

## Configuración pendiente para ejecutarla con datos reales

Usar el mismo proyecto Supabase; no la configuración del Firebase original. Los nombres están en `.env.example`:

| Variable | Destino | Contenido |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Navegador/build | URL del proyecto elegido |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Navegador/build | Clave pública activa `sb_publishable_...` |
| `SUPABASE_URL` | Servidor | La misma URL |
| `SUPABASE_SECRET_KEY` | Servidor exclusivamente | Clave secreta de backend del mismo proyecto; nunca prefijar con `VITE_` |
| `SUPABASE_ORGANIZATION_ID` | Servidor | UUID de organización indicado arriba |
| `GEMINI_API_KEY` | Servidor exclusivamente | Proveedor IA que ya usa la app original |

Configurar las claves privadas directamente en el gestor de variables de Vercel, como Secret, o en un `.env` local excluido de Git. No pegarlas en el chat ni incluirlas en el repositorio. No se han recuperado ni copiado claves privadas del entorno publicado. Para usar Gmail/Drive hay que configurar Google OAuth en Supabase, sus URLs de retorno y los ámbitos de Drive/Gmail; los permisos de Google requieren consentimiento del usuario. El token de Google no se envía al backend de gestión.

Comandos:

```sh
npm ci --no-audit --no-fund
npm run lint
npm run build
npm test
npm start
```

`npm start` ejecuta `build-server/replica.cjs`; las pantallas compiladas están en `dist`. Vercel utiliza `api/[...path].ts` para `/api/*` y la SPA para las demás rutas. `vercel.json` declara las opciones de build, protección contra caché de respuestas API y **despliegues automáticos de Git desactivados**. No se ha cambiado la configuración del proyecto Vercel existente `uniproyect-2-preview` ni creado un despliegue. La validez del enrutamiento en la plataforma debe comprobarse en una vista previa cuando el propietario autorice desplegar.

## Datos originales y ficheros

El ZIP es código: `initialData.ts` contiene colecciones vacías. No contiene una exportación completa de Firestore/Auth/Storage. En Drive conectado se buscó la copia `COPIA_SEGURIDAD_GLOBAL_UNIPROYECT.json` y después UniProyect; no se encontró un backup verificable. No se importaron datos de otro proyecto ni se fabricaron registros.

Las dos tablas nuevas están vacías tras revertir las pruebas. Para una réplica también idéntica en contenido hace falta una copia de seguridad actual de la aplicación original o una exportación autorizada de Firestore y archivos. La app conserva su restauración de copias; además, el siguiente comando valida un backup sin conectar con ninguna base:

```sh
node scripts/prepare-supabase-import.mjs copia.json
```

Con `--write` guarda operaciones en `migration-private/import.json`, excluido de Git, sin ejecutar la importación. Preserva los campos de negocio y rechaza identificadores ausentes/duplicados. Incluye fichajes si existen en el backup y elimina credenciales de cada registro. No importa usuarios ni reutiliza PIN antiguos: emitir nuevos QR. Para archivos referenciados por enlaces a Firebase/Drive será necesario copiar los binarios y comprobar acceso privado y enlaces; copiar únicamente el JSON no migra esos archivos. La copia global heredada puede omitir fichajes: comprobar el contenido antes de certificar una migración completa.

## Comprobaciones y límites

- TypeScript y build de la réplica correctos. Las 41 pruebas de la suite completa validan la API, QR, PIN, aislamiento, jornada, aprobación sin duplicar costes, conflicto de revisión, reinicio y revocación usando almacenamiento simulado. Las pruebas HTTP arrancan sin `.env` ni Firebase original.
- En la base Supabase real se probaron escritura/lectura de la organización, rechazo de otra organización y de identidad sin perfil, ausencia de privilegios públicos sobre el portal, persistencia y rechazo de revisión obsoleta. Los datos de prueba se revirtieron con `ROLLBACK`.
- Pantalla de acceso comprobada en navegador local. Las pantallas de gestión también se renderizan en pruebas a 390, 820 y 1920 px en ambos temas; esas pruebas no sustituyen una comparación visual completa de todas las pantallas.
- El PR de sincronización pasó CI de GitHub. La rama de réplica tiene comprobación independiente en su PR.
- No se ha probado inicio de sesión con la contraseña real del administrador, consentimiento Google, documentos reales, OCR Gemini de pago ni un despliegue Vercel. No se han modificado usuarios ni enviado invitaciones/correos.
- Permanecen 19 avisos de dependencias heredadas y un fragmento frontend de unos 2,7 MB. Deben resolverse antes de certificar producción; no se ejecutó `audit fix --force` que propone cambios incompatibles.
- Supabase Security Advisors: aviso previo de protección contra contraseñas filtradas desactivada y aviso informativo esperado por la tabla privada sin políticas. [Protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Vercel limita el tamaño de las peticiones: esta réplica acepta hasta 4 MB. Los archivos grandes deben procesarse por OCR local o subirse a almacenamiento privado; el límite heredado de 50 MB de Express no es equivalente en Vercel.

Referencias comprobadas: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [funciones de base de datos](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [verificación de usuario](https://supabase.com/docs/reference/javascript/auth-getuser).
