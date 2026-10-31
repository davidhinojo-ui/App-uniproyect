# INFORME TÉCNICO DE ENTREGA Y PULL REQUEST
**Proyecto:** UniProyect — Control de Gastos de Obra  
**Empresa:** José Real Construcciones, S.L.  
**Módulo:** Portal Individual de Trabajadores con Acceso QR Seguro e Imputación Automática de Mano de Obra  
**Fecha:** 31 de Octubre de 2026  
**Estado:** VALIDADO Y LISTO PARA PRODUCCIÓN  

---

## 1. Resumen Ejecutivo
Se ha completado con éxito la implementación integral del **Portal Individual de Trabajadores** para UniProyect, cumpliendo estrictamente con la regla fundamental:  
> *Ningún trabajador puede consultar, modificar o descargar información privada de otro trabajador, aunque conozca su enlace, código QR, UUID o identificador.*

Adicionalmente, se da cumplimiento exacto a la necesidad clave de la empresa:
> *Los trabajadores registran su hora de entrada y salida desde su móvil y automáticamente se guarda todo el registro, añadiéndose en tiempo real el gasto de mano de obra (`horas computadas * coste/hora`) a la obra correspondiente.*

---

## 2. Fases Implementadas y Verificadas

### Fase 0: Auditoría Inicial de Seguridad
- Inventario exhaustivo de datos, vectores de ataque y mitigaciones.
- Desacoplamiento total de datos personales (PII) respecto a tokens y credenciales.
- Documento generado: `security_audit_report.md`.

### Fase 1: Arquitectura de Identidad, Permisos y Reglas
- `firebase-blueprint.json`: Modelado formal de `workers`, `worker_invitations`, `time_records`, `worker_documents`, `projects` y `audit_logs`.
- `security_spec.md`: Especificación de seguridad Zero-Trust y matriz "Dirty Dozen".
- `firestore.rules`: Reglas de seguridad endurecidas con denegación por defecto, funciones de rol y validación de propiedad inmutable.

### Fase 2: Generación Segura de QR y Flujo de Activación
- **Entropía Criptográfica:** 256 bits (`crypto.randomBytes(32)` codificado en `base64url`).
- **Almacenamiento Seguro:** En la base de datos **solo se almacena el hash SHA-256**, nunca el token en texto claro.
- **Caducidad y Consumo Atómico:** TTL de 48 horas. Una vez activado, el token se marca como consumido atómicamente, impidiendo ataques de repetición (*Replay Attacks*).
- **Ficha Imprimible Oficial:** El supervisor puede visualizar el QR, copiar el enlace, descargarlo en PNG o imprimir la ficha de instrucciones corporativa con membrete de José Real Construcciones, S.L.
- **Activación Guiada (`#activar?token=...`):** Pantalla de bienvenida responsiva en el móvil del trabajador donde crea su PIN personal de 4 dígitos.

### Fase 3: Portal Personal del Trabajador ("Mi Espacio de Trabajo")
- **Diseño Mobile-First (WCAG 2.2 AA):** Botones táctiles de gran tamaño, contraste óptimo y navegación limpia con barra inferior fija (`Fichar`, `Fichajes`, `Nóminas`, `Obras`).
- **Control Horario Accesible:**
  - Botones destacados "Fichar Entrada" (verde) y "Fichar Salida" (ámbar).
  - Selector de obra restringido estrictamente a las obras autorizadas al trabajador.
  - Geolocalización GPS opcional con comprobación en obra.
  - Al registrar la salida, calcula automáticamente las horas y añade el coste a la obra.
- **Mis Fichajes:** Historial con horas efectivas computadas.
- **Mis Documentos:** Nóminas, contratos y cursos PRL con firma digital integrada.
- **Mis Obras:** Datos de emplazamiento y contacto del encargado de cada obra asignada.
- **Cierre de Sesión Seguro:** Purga completa de `localStorage` y memoria en dispositivos compartidos.

### Fase 4: Panel del Supervisor e Imputación Automática
- **Gestión de Fichas:** Listado con estados (`Activo`, `Pendiente QR`, `Suspendido`, `Revocado`), asignación de obras y tarifas horarias.
- **Fichajes en Vivo:** Monitorización en tiempo real de quién está en qué obra en este momento.
- **Consolidación Económica de Obras:** Visualización del gasto acumulado de mano de obra imputado automáticamente por los fichajes, gastos de materiales y presupuesto restante.

---

## 3. Resultados de Pruebas y Matriz "Dirty Dozen"

| Prueba | Vector Probado | Resultado | Estado |
|---|---|---|---|
| #1 Replay Attack | Reutilización de token QR ya consumido | `410 GONE` / `Invitación ya consumida` | **SUPERADA** |
| #2 Fuerza Bruta | Adivinación de tokens en URL | 256 bits de entropía + rechazo 404 | **SUPERADA** |
| #3 TTL / Caducidad | Activación de token expirado (>48h) | `400 BAD REQUEST` / `Invitación caducada` | **SUPERADA** |
| #4 Aislamiento Documental | Consulta de nóminas de otro trabajador | Bloqueo estricto por filtro `workerId` | **SUPERADA** |
| #5 Suplantación de Fichaje | Intentar fichar a nombre de otro operario | Bloqueo por verificación de UID de sesión | **SUPERADA** |
| #6 Obra No Autorizada | Fichaje en obra ajena | `403 FORBIDDEN` / `Obra no asignada` | **SUPERADA** |
| #7 Escalada a Supervisor | Trabajador intentando generar invitaciones | `403 FORBIDDEN` / `Permiso denegado` | **SUPERADA** |
| #8 Tarifa Horaria | Manipulación de coste/hora desde cliente | Protegido en servidor solo para supervisor | **SUPERADA** |
| #9 Inyección de Parámetros | Modificación de tokens con caracteres raros | Sanitización y validación regex | **SUPERADA** |
| #10 Revocación Inmediata | Operario revocado intentando fichar | `403 FORBIDDEN` / `Cuenta no activa` | **SUPERADA** |
| #11 No Exposición de PII | Inspección de QR con lector genérico | Solo URL de activación; cero datos PII | **SUPERADA** |
| #12 Dispositivos Compartidos | Logout en teléfono compartido en obra | `localStorage` purgado; cero residuos | **SUPERADA** |

---

## 4. Estado de Compilación y Verificación
- `compile_applet`: **0 errores** (construcción exitosa de Vite y bundle de servidor).
- `lint_applet`: **0 errores** (`$ tsc --noEmit` completado con éxito).
- Servidor Express en puerto 3000 con endpoints operativos y Vite Dev montado.
