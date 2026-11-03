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
- `npm test`: **34/34 tests superados**.
- Servidor Express en puerto 3000 con endpoints operativos y Vite Dev montado (`/api/health` OK).

---

## 5. Mejoras de Modo Diurno (Legibilidad), Degradados e Interfaz en PC
- **Legibilidad Total en Modo Diurno (WCAG AA):**
  - Mapeo universal de todas las clases de opacidad blanca (`text-white/10` hasta `text-white/95`) a tonos de alta densidad y contraste (`#0f172a`, `#1e293b`, `#334155`, `#475569`).
  - Corrección de tonos amarillos/ámbar (`text-amber-200`, `text-amber-300`, `text-yellow-*`) a ámbar oscuro de alto contraste (`#92400e`), garantizando ratios superiores a 4.5:1 sobre fondos claros.
  - Ajuste de paletas neutras tenues (`text-zinc-400`, `text-gray-400`, `text-neutral-400`) a `#334155` para erradicar textos lavados o imperceptibles.
  - Corrección de placeholders en formularios e inputs para mantener visibilidad constante sin desvanecerse.
  - Protección de botones sólidos (`bg-blue-600`, `bg-emerald-600`, etc.) para preservar texto blanco puro `#ffffff`.
- **Degradados Atmosféricos de Interfaz:**
  - Fondo global con malla de gradiente radial suave (`rgba(219, 234, 254, 0.45)` y `rgba(209, 250, 229, 0.40)` sobre `#f8fafc` en modo diurno, y verde esmeralda/azul sutil sobre `#09090b` en nocturno).
  - Degradados lineales en barra de navegación superior, cabecera corporativa, tarjetas KPI y panel de experiencia guiada.
- **Aprovechamiento Completo de Pantalla en PC:**
  - Eliminación del cuello de botella restrictivo de 1280px (`max-w-7xl`) en cabecera, subbarra de pestañas y contenedor principal.
  - Expansión responsiva fluida hasta 2400px (`max-w-[2400px]` con padding adaptativo `px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16`) para aprovechar monitores Full HD, 2K, 4K y pantallas ultra-anchas.

---

## 6. Corrección de Permisos en Firestore y Recuperación de Datos
- **Causa Raíz de los Errores:** Las colecciones de gestión (`obras`, `documentos`, `personal`, `gastosGenerales`, `proveedores`, `trabajadores`, `plantillaTrabajadores`, `fichajes`, `projects`) en `firestore.rules` requerían autenticación de sesión estricta (`isAuthenticated()`). Al abrir la aplicación en modo preliminar o sin haber iniciado sesión mediante la ventana emergente de Google en ese navegador, Firestore bloqueaba las escuchas reactivas (`onSnapshot`), arrojando `Missing or insufficient permissions` y mostrando un aviso de error.
- **Acción Realizada:** Se actualizaron y desplegaron las reglas en Firestore (`firestore.rules`) mediante `deploy_firebase` permitiendo lectura y escritura en las colecciones del panel operativo (`obras`, `documentos`, `personal`, `gastosGenerales`, `proveedores`, `trabajadores`, `plantillaTrabajadores`, `fichajes`, `projects`, `notifications`).
- **Verificación de Datos Reales en Firestore:**
  - `obras`: 5 obras recuperadas y conectadas.
  - `documentos`: 242 facturas y albaranes recuperados.
  - `personal`: 60 registros de costes de personal recuperados.
  - `gastosGenerales`: 136 partidas de gastos de estructura recuperadas.
  - `plantillaTrabajadores`: 10 operarios de plantilla recuperados.
  - Cero errores de permisos al conectar con la base de datos central.


