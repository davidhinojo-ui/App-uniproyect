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

La CLI de Firebase devuelve `Failed to authenticate` al consultar proyectos. El plugin aparece instalado pero no expone operaciones Firebase en esta sesión. No hay proyecto Firebase autenticado, cuenta de servicio/IAM verificados ni identidad del supervisor real acreditados aquí.

Antes de publicar hay que completar, en el proyecto original:

1. Confirmar proyecto Firebase/Google Cloud de UniProyect, base Firestore y cuenta de servicio del Cloud Run existente. Usar identidad administrada y Application Default Credentials; no descargar ni compartir claves privadas. Habilitar proveedor Google y dominio autorizado para la URL real.
2. Configurar `UNIPROYECT_ORGANIZATION_ID`, `PUBLIC_APP_URL` (HTTPS), `FIREBASE_WEB_CONFIG` con los campos públicos de Firebase (`apiKey`, `projectId`, `authDomain`, `appId`). No es una contraseña; la autorización depende de tokens y claims verificados en servidor. No existe archivo con secretos en el repositorio.
3. Asignar mediante un administrador autenticado los claims role/organizationId al UID real del propietario, conservando sus demás claims. Verificar que una cuenta distinta y otra organización sean rechazadas. Este paso no se ha ejecutado ni se ha inventado un UID.
4. **Antes de reiniciar la versión antigua**, detener temporalmente las escrituras y extraer una copia coherente del proceso vivo con trabajadores, obras, fichajes, documentos, invitaciones y auditoría. Sus arrays viven en memoria y un nuevo despliegue no puede recuperarlos después. No hay endpoint seguro de exportación integral en el servidor antiguo; se requiere acceso administrativo al entorno original. No es suficiente recopilar pantallas ni reiniciar para añadir una exportación.
5. Validar el snapshot JSON completo y conservarlo fuera de Git. Ejecutar `node --import tsx scripts/import-legacy-state.ts RUTA_SNAPSHOT` con `GOOGLE_CLOUD_PROJECT` explícito. Sin `--apply` solo valida. Con `--apply`, importa atómicamente a destino vacío, preserva IDs, convierte PIN y omite los tokens QR planos; rechaza destino existente y snapshots parciales. Máximo 450 documentos para esta importación atómica: si hay más, se necesita migración por fases con reconciliación, sin recortar datos. Las sesiones antiguas no se migran: se vuelve a iniciar sesión.
6. Verificar conteos, relaciones, costes, fichajes y acceso del propietario. El backend rechaza el almacenamiento sin `migrationCompleted=true`, de modo que no se confunda un destino vacío con una migración correcta.
7. Desplegar primero una revisión sin tráfico público, probar supervisor/trabajador/QR/fichajes y recuperación tras reinicio; después promover la revisión y comprobar `/version.json` y flujos en la URL real. No cambiar la exposición ni permisos de Cloud Run automáticamente.

## Límites conocidos

El adaptador conserva la lógica existente ejecutándola sobre snapshots transaccionales por empresa. Lee las colecciones de esa empresa y serializa sus escrituras con un documento de coordinación; no está diseñado aún para altos volúmenes. Rechaza operaciones que excedan 450 escrituras en vez de confirmar parcialmente. Necesita pruebas de carga y paginación/servicios de repositorio por operación antes de escalar. No borra registros de auditoría ni datos de negocio; sesiones caducadas/intentos requieren una política TTL revisada separadamente.

La configuración y migración verificadas son requisitos reales para no bloquear al propietario o perder registros, no una falta de autorización del usuario. Ningún cambio de este PR se ha fusionado ni publicado automáticamente.

Referencias oficiales: https://firebase.google.com/docs/auth/admin/verify-id-tokens · https://firebase.google.com/docs/auth/admin/manage-sessions · https://firebase.google.com/docs/firestore/manage-data/transactions
