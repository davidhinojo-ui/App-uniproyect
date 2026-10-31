# AUDITORÍA DE SEGURIDAD Y ANÁLISIS DE CÓDIGO PREVIO
**Proyecto:** UniProyect — Control de Gastos de Obra  
**Repositorio:** davidhinojo-ui/App-uniproyect  
**Fecha:** 31 de Octubre de 2026  
**Equipo:** Senior Security & Frontend Engineering  
**Alcance:** Fichas de trabajadores, autenticación, control horario, generación y activación de códigos QR, aislamiento multi-tenant y reglas de seguridad.

---

## 1. Contexto y Objetivos de la Auditoría
UniProyect (José Real Construcciones, S.L.) gestiona obras, costes, gastos, facturas, albaranes y mano de obra.
El objetivo del requerimiento es dotar a cada trabajador de un portal individual, seguro, accesible mediante código QR con token criptográfico de un solo uso, manteniendo **aislamiento estricto de datos** en el servidor (Firestore y Backend), garantizando que:
- Ningún trabajador pueda consultar, alterar o descargar datos de otros trabajadores (cero fugas transversales).
- El supervisor mantenga el control integral (creación de invitaciones, revocación en tiempo real, asignación de obras y consolidación de costes de mano de obra).

---

## 2. Inventario de Componentes y Estado Inicial del Repositorio

| Elemento / Módulo | Estado Previo | Riesgo de Seguridad Detectado | Severidad | Acción Mitigadora |
|---|---|---|---|---|
| **Gestión de Trabajadores** | Registro básico en ficha | Identificadores predecibles o uso potencial de DNI/teléfono como clave de acceso | **CRÍTICA** | Crear identificador interno inmutable (`UUID v4`), desvinculando DNI de credenciales y rutas. |
| **Acceso al Portal** | Inexistente / no securizado | Sin flujo de activación seguro; riesgo de URLs públicas con parámetros predecibles | **CRÍTICA** | Diseñar flujo con token criptográfico de alta entropía (256 bits), almacén de hash SHA-256 con caducidad (48h) y consumo atómico de un solo uso. |
| **Control Horario (Fichajes)** | Registro centralizado por supervisor | Potencial acceso de lectura global si no se aplican filtros y reglas por `workerId` | **ALTA** | Reglas Firestore con validación `request.auth.uid == resource.data.firebaseAuthUid` y validación de campos inmutables. |
| **Documentación Laboral** | Archivos accesibles en fichas | Fuga de nóminas y contratos entre trabajadores | **CRÍTICA** | Almacenamiento segregado por `workerId` con reglas de Storage/Firestore que prohíben la lectura a terceros. |
| **Reglas Firestore** | Ausentes o permisivas por defecto | Lectura y escritura masiva si no se despliegan reglas de producción blindadas | **CRÍTICA** | Especificación e implementación de `firestore.rules` con 8 pilares de seguridad y denegación por defecto. |
| **Sesiones y Caché en Dispositivos Compartidos** | Almacenamiento en LocalStorage sin purga | En teléfonos compartidos en obra, el siguiente usuario podría ver la sesión anterior | **ALTA** | Implementar `purgeSession()` con limpieza inmediata de tokens, IndexedDB y LocalStorage al cerrar sesión o expirar. |

---

## 3. Matriz de Vectores de Ataque Analizados (Zero-Trust)

1. **Ataque de Enumeración / Fuerza Bruta de URLs de Invitación:**
   - *Vector:* Intentar iterar sobre `/activar?token=...`
   - *Mitigación:* Tokens criptográficos de 32 bytes (256 bits de entropía en base64url). El espacio de claves ($2^{256}$) hace imposible la enumeración matemática o por fuerza bruta. En el servidor solo se almacena el hash `SHA-256(token)`.
2. **Reutilización de Tokens (Replay Attack):**
   - *Vector:* Un tercero intercepta el enlace QR ya consumido.
   - *Mitigación:* Consumo atómico en base de datos. Una vez activado, el registro se marca `consumed: true`, `consumedAt: timestamp` y se vincula irreversiblemente al UID del trabajador. Cualquier intento posterior devuelve error 410 Gone / 403 Forbidden.
3. **Escalada Horizontal de Privilegios:**
   - *Vector:* El trabajador $A$ modifica las peticiones en el cliente para pedir `/api/time-records?workerId=B`.
   - *Mitigación:* Validación estricta en backend y reglas Firestore (`request.auth.uid == resource.data.firebaseAuthUid`). El parámetro `workerId` enviado por el cliente es ignorado si difiere de la identidad autenticada.
4. **Fuga de Datos Personales (PII) en el Código QR:**
   - *Vector:* Terceros escanean el código QR impreso o en pantalla.
   - *Mitigación:* El código QR **no contiene ningún dato personal** (ni nombre, ni DNI, ni teléfono, ni obra). Solo contiene la URL de activación HTTPS con el token opaco de un solo uso.
5. **Revocación Inmediata de Acceso:**
   - *Vector:* Un trabajador es dado de baja pero conserva la sesión activa.
   - *Mitigación:* Estado de trabajador en base de datos (`status: 'active' | 'suspended' | 'revoked'`). Las reglas de Firestore y las rutas de API verifican en cada operación que el trabajador esté en estado `active`.

---

## 4. Conclusión de la Auditoría y Vía Libre para Fase 1
El sistema requiere:
1. `firebase-blueprint.json` con el modelado formal de entidades y especificaciones de seguridad.
2. `security_spec.md` con la definición exhaustiva de contratos y matriz de pruebas Dirty Dozen.
3. `firestore.rules` con las reglas de acceso granulares para Supervisor y Trabajador.
4. Desarrollo de componentes UI/UX responsive y accesibles (WCAG 2.2 AA) tanto para el Supervisor como para el Portal Personal del Trabajador.
