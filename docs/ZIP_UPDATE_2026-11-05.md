# Actualización de la réplica con el ZIP del Escritorio

## Fuente comprobada

- Archivo aportado: `uniproyect (ok).zip` del Escritorio del propietario.
- SHA-256: `391d2e943a78da2eee1e5f5de7b81ea64ca1379199c80ea2f4525ae1fbc52ee0`.
- Contiene 88 archivos: 80 iguales y 8 modificados respecto al ZIP anterior, normalizando finales de línea. Es una versión de código nueva; sigue sin ser una exportación de Firestore o un backup completo de datos.
- La autorización del propietario incluye sus tarifas y la actualización del PR #11, sin fusión ni despliegue.

## Integración

- Se incorporan las cuatro vistas modificadas: edición en línea de coste/hora, Control Horario, Personal y portal de operario. Se conserva la composición de las pantallas, con etiqueta accesible en el editor y validación de números finitos positivos.
- La carga de plantilla de gestión conserva `standardHourlyRate`, `hourlyRate`, tarifa diaria y horas extra.
- Los cambios de `server.ts` y del servicio original se conservan como referencia; el JavaScript se regenera desde TypeScript, manteniendo la corrección previa de salidas sin entrada y fichajes repetidos.
- La API utilizada en Vercel admite `PUT` y `PATCH` para editar trabajadores. La edición de DNI y coste/hora se guarda junto con el estado del portal en el commit transaccional de Supabase. No vuelve a conectarse a Firestore.
- Se guardan las tarifas estándar, horaria, diaria (`Math.round(hora * 8)`) y extra derivada (`hora * 1.35`, dos decimales). Las demás propiedades de la ficha se conservan, incluida una tarifa extra configurada si solo cambia otro campo.
- Se incluyen las diez tarifas de referencia del ZIP (14,50–22 €/h) por sus identificadores originales, sin añadir trabajadores automáticamente a la base. Al leer una ficha, la tarifa estándar configurada prevalece, seguida de la horaria heredada, la diaria dividida entre ocho, la referencia del ZIP y, finalmente, 18 €/h.
- Se mantienen los valores específicos de cada formulario del ZIP: el alta de Personal propone 18,50 €/h, 148 €/día y 24 €/h extra; los cálculos derivados utilizan el factor indicado por el ZIP cuando no existe una tarifa extra explícita.
- Un cambio de tarifa no recalcula jornadas cerradas ni gastos históricos. La jornada abierta conserva la tarifa de su entrada; las siguientes entradas utilizan la tarifa nueva.

## Validación

Se amplía la suite con comprobaciones de precedencia de tarifas, referencias del ZIP, rechazo de importes inválidos y aprobación de una jornada histórica con tarifa distinta de la ficha actual. La prueba de API verifica `PATCH`/`PUT`, persistencia de los cuatro importes, rechazo de una edición no autenticada, recuperación tras reiniciar y conservación de la tarifa durante una jornada abierta.

Las pruebas usan almacenamiento simulado y el servidor local; no ejecutan operaciones contra la aplicación publicada. Los resultados de TypeScript, build, suite y CI del commit final quedan en el PR. Permanecen los límites de configuración, migración de datos, proveedores externos y dependencias descritos en `VERCEL_SUPABASE_REPLICA.md`.

No se han modificado datos reales, esquemas Supabase, configuración Vercel ni el despliegue publicado en esta actualización.
