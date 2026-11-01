# Autenticación y persistencia — preparación del 1 de noviembre de 2026

Implementación sobre `main` tras el PR #5. No publicada ni conectada a datos reales.

## Correcciones

- Supervisor: acceso con Google/Firebase y comprobación en servidor de firma, caducidad y revocación del ID token. Claims **role=supervisor** y **organizationId** deben coincidir con la empresa configurada. No existe autoasignación del primer administrador ni autorización por correo enviada desde el navegador.
- Trabajador: sesiones aleatorias de 256 bits, validez de ocho horas, conservadas solo como hash; comprobación de propiedad, estado activo y versión del PIN en cada petición. Cierre de sesión, suspensión y revocación invalidan accesos. No se aceptan tokens antiguos predecibles ni workerId como credencial.
- PIN: scrypt con sal aleatoria, comparación segura y conversión de PIN heredados antes de persistir. Nunca se retornan PIN, hashes ni secretos en las respuestas. Cinco intentos por identificador en cada ventana de quince minutos, persistidos en Firestore.
- Lecturas, cambios, consumo de QR, fichajes, costes, sesiones y auditoría se ejecutan en transacciones Firestore. El contexto de cada petición está aislado con AsyncLocalStorage. La respuesta se envía después de confirmar el commit; si falla el almacenamiento no se confirma la operación.
- Namespace servidor `uniproyect_orgs/{organizationId}` con colecciones separadas. Las reglas existentes deniegan por defecto el acceso directo a este namespace; el Admin SDK opera con IAM de la cuenta del servicio. No se han publicado ni modificado reglas Firestore.
- No hay datos de ejemplo insertados al arrancar ni fallback a arrays globales. Los fixtures anteriores quedan preservados en `tests/fixtures/legacy-state.ts` como material offline, nunca importado automáticamente.
- Se conserva el circuito guiado/completo, fichaje asistido, QR y previsualización de trabajador para supervisor autorizado. El acceso de prueba no rellena ningún PIN. La matriz de seguridad deja de anunciar pruebas ficticias como superadas.

## Pruebas

TypeScript y build correctos. 31 pruebas unitarias/HTTP/regresión más 7 integraciones con Firestore Emulator 1.19.8 (Java 17): aislamiento, hashing, rechazo de accesos anónimos, PIN erróneo, suspensión, QR de un solo uso incluso con activaciones concurrentes, commit/rollback, incrementos concurrentes, sesión persistida como hash, aislamiento HTTP y logout, recuperación desde dos procesos Node independientes.

No equivalen a validar el login de Google, IAM, configuración, reglas o datos reales de producción. No se han ejecutado operaciones contra el Firebase real. El emulador reciente 1.22 requiere Java 21; se utiliza el emulador oficial 1.19.8 compatible con Java 17 también en CI.

## Activación pendiente: no desplegar todavía

La sesión local no tiene una identidad de Firebase/Google Cloud autenticada para ejecutar el cambio. Las capturas de la sesión del propietario ya identifican el proyecto `linear-connection-w07pf`, la base con nombre `ai-studio-b1dc625c-0de8-4322-97f8-d1cb16d0fdce`, Cloud Run `uniproyect` en `europe-west2` y su cuenta de servicio `112691093407-compute@developer.gserviceaccount.com`. Esto no acredita los claims del propietario ni permisos de despliegue desde esta sesión.

### Hallazgo posterior: los datos históricos no son el snapshot del portal

El propietario confirmó que las obras de la aplicación publicada son ejemplos. La copia histórica descargada y verificada en su Cloud Shell contiene 918 documentos y 25 colecciones, con lectura `2026-11-01T21:45:08.223530Z`. La comprobación de JSON/gzip y nombres únicos no equivale a ensayar una restauración. No se ha subido la copia al repositorio ni se han leído aquí sus valores personales.

| Ruta sin identificadores | Documentos |
| --- | ---: |
| documentos | 242 |
| gastosGenerales | 136 |
| notifications | 36 |
| obras | 5 |
| personal | 60 |
| plantillaTrabajadores | 10 |
| users/{uid}/documentos | 155 |
| users/{uid}/gastosGenerales | 70 |
| users/{uid}/notifications | 134 |
| users/{uid}/obras | 3 |
| users/{uid}/personal | 37 |
| users/{uid}/plantillaTrabajadores | 18 |
| users/{uid}/proveedores | 6 |
| users/{uid}/trabajadores | 6 |

Los recuentos bajo `users/{uid}` agregan varios posibles propietarios; no prueban que todo pertenezca a David. El campo `personal` incluye costes/jornales y no se puede tratar automáticamente como una ficha de trabajador. Los documentos de gastos no equivalen a documentos de trabajador. Tampoco se han confirmado las reglas de propiedad de las colecciones raíz. **No copiar todo al namespace de una única empresa ni convertir estos registros automáticamente con `import-legacy-state.ts`.**

Correcciones preparadas: `firestoreDb()` exige proyecto, base y organización explícitos fuera del emulador; runtime e importador usan la misma base con nombre. `.env.example` incluye solo identificadores públicos y deja la organización pendiente de verificar. El importador rechaza explícitamente `uniproyect-firestore-rest-v1`. El inspector offline `scripts/inspect-firestore-backup.ts` comprueba identidades/rutas/duplicados/inventario y genera campos y recuentos por ámbito con alias de usuario, sin valores de documentos ni UIDs. No importa datos ni marca una migración como finalizada.

Para ejecutar el inspector localmente sobre una copia conservada fuera de Git:

```bash
node --import tsx scripts/inspect-firestore-backup.ts RUTA_COPIA.json.gz linear-connection-w07pf ai-studio-b1dc625c-0de8-4322-97f8-d1cb16d0fdce
```

La conexión real sigue pendiente: verificar el UID y su relación con los datos de cada ámbito; definir y probar el adaptador de obras/personal/gastos/documentos sin pérdida; verificar Google Auth/claims; y ensayar la restauración/migración en un entorno aislado antes del despliegue. El cambio de selector de base por sí solo **no** hace aparecer los datos históricos en el portal.

Validación local de esta actualización: TypeScript, build, 35 pruebas unitarias/HTTP/regresión y arranque del servidor compilado correctos. Incluye rechazo del archivo histórico tanto JSON como gzip incluso con `--apply`, sin inicializar Firebase. La integración ahora apunta expresamente a una base con nombre dentro del emulador. No se ha podido repetir localmente esa integración porque la descarga del JAR oficial agotó la conexión; queda pendiente de la CI. No confundir las 7 integraciones de la revisión anterior con pruebas del nuevo selector de base.

Antes de publicar hay que completar, en el proyecto original:

1. Usar el proyecto y la base identificados arriba con identidad administrada y Application Default Credentials; no descargar ni compartir claves privadas. Verificar la edición/metadatos antes de incorporar consultas específicas de edición. Habilitar proveedor Google y dominio autorizado para la URL real.
2. Configurar `UNIPROYECT_ORGANIZATION_ID`, `PUBLIC_APP_URL` (HTTPS), `FIREBASE_WEB_CONFIG` con los campos públicos de Firebase (`apiKey`, `projectId`, `authDomain`, `appId`). No es una contraseña; la autorización depende de tokens y claims verificados en servidor. No existe archivo con secretos en el repositorio.
3. Asignar mediante un administrador autenticado los claims role/organizationId al UID real del propietario, conservando sus demás claims. Verificar que una cuenta distinta y otra organización sean rechazadas. Este paso no se ha ejecutado ni se ha inventado un UID.
4. **Antes de reiniciar la versión antigua**, detener temporalmente las escrituras y extraer una copia coherente del proceso vivo con trabajadores, obras, fichajes, documentos, invitaciones y auditoría. Sus arrays viven en memoria y un nuevo despliegue no puede recuperarlos después. No hay endpoint seguro de exportación integral en el servidor antiguo; se requiere acceso administrativo al entorno original. No es suficiente recopilar pantallas ni reiniciar para añadir una exportación.
5. Distinguir la copia Firestore histórica del snapshot del portal. Para un snapshot válido del portal, `node --import tsx scripts/import-legacy-state.ts RUTA_SNAPSHOT` sin `--apply` solo valida. Con `--apply` exige proyecto/base/organización explícitos, importa atómicamente a destino vacío, preserva IDs, convierte PIN y omite tokens QR planos. Rechaza destino existente, snapshots parciales y copias históricas del otro esquema. Su límite de 450 documentos no sirve para la copia histórica de 918 documentos: esa requiere un adaptador y procedimiento propios, sin recortes. Las sesiones antiguas no se migran.
6. Verificar conteos, relaciones, costes, fichajes y acceso del propietario. El backend rechaza el almacenamiento sin `migrationCompleted=true`, de modo que no se confunda un destino vacío con una migración correcta.
7. Desplegar primero una revisión sin tráfico público, probar supervisor/trabajador/QR/fichajes y recuperación tras reinicio; después promover la revisión y comprobar `/version.json` y flujos en la URL real. No cambiar la exposición ni permisos de Cloud Run automáticamente.

## Límites conocidos

El adaptador conserva la lógica existente ejecutándola sobre snapshots transaccionales por empresa. Lee las colecciones de esa empresa y serializa sus escrituras con un documento de coordinación; no está diseñado aún para altos volúmenes. Rechaza operaciones que excedan 450 escrituras en vez de confirmar parcialmente. Necesita pruebas de carga y paginación/servicios de repositorio por operación antes de escalar. No borra registros de auditoría ni datos de negocio; sesiones caducadas/intentos requieren una política TTL revisada separadamente.

La configuración y migración verificadas son requisitos reales para no bloquear al propietario o perder registros, no una falta de autorización del usuario. Ningún cambio de este PR se ha fusionado ni publicado automáticamente.

Referencias oficiales: https://firebase.google.com/docs/auth/admin/verify-id-tokens · https://firebase.google.com/docs/auth/admin/manage-sessions · https://firebase.google.com/docs/firestore/manage-data/transactions
