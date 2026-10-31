# ESPECIFICACIÓN DE SEGURIDAD Y ARQUITECTURA ZERO-TRUST (SECURITY_SPEC.MD)
**Aplicación:** UniProyect — Control de Gastos de Obra  
**Empresa:** José Real Construcciones, S.L.  
**Módulo:** Portal Individual de Trabajadores con Acceso QR Seguro  
**Fecha:** 31 de Octubre de 2026  

---

## 1. Principio Rector y Aislamiento Estricto
**Regla Fundamental:** Ningún trabajador podrá consultar, modificar o descargar información privada de otro trabajador (fichajes, nóminas, contratos, obras no asignadas, DNI, teléfono), aunque conozca su enlace, código QR, identificador UUID o UID de Firebase.

---

## 2. Arquitectura de Identidad y Ciclo de Vida del Trabajador

### 2.1 Identificador Inmutable
- Cada trabajador cuenta con un `id` interno inmutable generado mediante `crypto.randomUUID()`.
- Ni el DNI/NIE, ni el número de teléfono, ni el nombre se utilizan como identificador público ni como token.
- La entidad `workers` almacena:
  - `status`: `'pending' | 'active' | 'suspended' | 'revoked'`
  - `firebaseAuthUid`: `null` en estado inicial; vinculado atómicamente en el primer acceso.
  - `assignedProjectIds`: lista explícita de IDs de obras autorizadas.

### 2.2 Generación Criptográfica de Códigos QR
1. **Entropía:** Se generan 32 bytes criptográficamente seguros mediante `crypto.randomBytes(32)` o `crypto.getRandomValues(new Uint8Array(32))` codificados en `base64url` (~43 caracteres).
2. **Almacenamiento del Token:** El servidor **NUNCA** guarda el token en texto plano en la base de datos ni en logs. En `worker_invitations` se almacena exclusivamente el hash `SHA-256(token)`.
3. **Contenido del QR:** El QR únicamente contiene la URL HTTPS de activación:
   `https://[dominio-uniproyect]/activar?token=[TOKEN_ALEATORIO]`
   *Ningún dato personal (nombre, DNI, empresa, obra) figura en el código QR.*
4. **Caducidad (TTL):** La invitación expira a las 48 horas de su emisión (`expiresAt`).
5. **Consumo Atómico:** Al activarse, la transacción verifica `consumed == false`, `revoked == false` y `expiresAt > now()`, actualizando en la misma operación `consumed = true`, `consumedAt = now()` y vinculando el UID del trabajador.

### 2.3 Revocación y Suspensión Inmediata
- Si un supervisor pulsa **Revocar acceso**, el estado del trabajador pasa inmediatamente a `'revoked'` y todas las invitaciones pendientes se marcan `'revoked = true'`.
- Cualquier intento de fichaje, consulta de documentos o renovación de token por parte de un trabajador suspendido o revocado es rechazado de inmediato.

---

## 3. Matriz de Pruebas de Intrusión: "The Dirty Dozen"

| # | Escenario de Ataque / Intrusión | Payload o Acción Maliciosa | Resultado Esperado | Mecanismo de Bloqueo |
|---|---|---|---|---|
| **1** | **Reutilización de QR ya activado (Replay)** | Petición a `/api/worker-portal/activate` con token ya consumido | `410 GONE` o `400 BAD REQUEST` ("Invitación ya utilizada") | Verificación atómica del campo `consumed: false` |
| **2** | **Fuerza bruta de token QR** | Envío de tokens aleatorios adivinados a `/api/worker-portal/verify` | `404 NOT FOUND` + Rate limit (10 peticiones/min) | Entropía de 256 bits ($2^{256}$ combinaciones) + Rate limiter |
| **3** | **Invitación caducada (>48h)** | Activación de token válido cuyo `expiresAt` < `Date.now()` | `400 BAD REQUEST` ("Invitación caducada. Solicite un nuevo QR a su supervisor") | Validación de timestamp estricta en servidor |
| **4** | **Lectura transversal de nóminas de otro trabajador** | `worker_documents` consulta con `workerId = 'otro-trabajador-id'` | `403 PERMISSION_DENIED` | Regla Firestore `isOwner(resource.data.workerId)` |
| **5** | **Suplantación en fichaje (Horizontal Spoofing)** | Trabajador A envía `check_in` con `workerId: 'trabajador-B'` | `403 FORBIDDEN` | El backend y Firestore verifican que `workerId` coincida con el UID autenticado en la sesión |
| **6** | **Fichaje en obra no autorizada** | Trabajador envía fichaje para una obra fuera de `assignedProjectIds` | `403 FORBIDDEN` ("Obra no asignada al trabajador") | Verificación de pertenencia en `worker.assignedProjectIds` |
| **7** | **Escalada de privilegios a Supervisor** | Trabajador autenticado intenta invocar `/api/worker-portal/create-invitation` | `403 FORBIDDEN` ("Permiso denegado: solo supervisores") | Validación de rol `role == 'supervisor'` en token de sesión |
| **8** | **Modificación de tarifas horarias por trabajador** | Petición PUT/PATCH para elevar `hourlyRate` en la ficha | `403 FORBIDDEN` | Restricción estricta de escritura en `workers` reservada al supervisor |
| **9** | **Inyección de parámetros / manipulado de URL** | Manipulación de `?token=../../../` o caracteres especiales | `400 BAD REQUEST` | Validación regex `^[A-Za-z0-9_-]{32,64}$` |
| **10** | **Acceso tras revocación del supervisor** | Trabajador revocado intenta consultar su portal con sesión antigua | `401 UNAUTHORIZED` / `403 FORBIDDEN` | Comprobación en tiempo real de `worker.status === 'active'` |
| **11** | **Inspección de tráfico o fuga de tokens en logs** | Búsqueda del token plano en registros o Firestore | Token ausente (solo existe hash SHA-256) | Cifrado y hashing unidireccional |
| **12** | **Fuga de datos en teléfonos compartidos en obra** | Usuario cierra sesión; siguiente persona usa el navegador móvil | Pantalla limpia, sesión vacía, sin datos residuales | Purga total de LocalStorage, sessionStorage e IndexedDB en `logout()` |

---

## 4. Política de Dispositivos Compartidos y Modo Offline
- En obras de construcción es habitual que varios operarios compartan una misma tablet o teléfono.
- El cierre de sesión invoca inmediatamente la función `secureWorkerLogout()` que:
  1. Revoca el token local de sesión.
  2. Limpia `localStorage.removeItem('uniproyect_worker_session')`.
  3. Purga cualquier registro de fichaje en caché temporal.
  4. Redirige a la pantalla limpia de bienvenida/escaneo de QR.
