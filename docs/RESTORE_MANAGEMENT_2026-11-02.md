# Recuperación de Obras y costes

El punto de entrada publicado solo montaba el módulo de trabajadores y fichajes. El ZIP `uniproyect.zip` de 30/10/2026 contiene la aplicación de gestión completa, ausente del ZIP posterior `uniproyect (1).zip`.

Se recupera su código dentro de `src/management`, conservando el módulo actual y las correcciones de temas. El inicio predeterminado pasa a gestión; `#workforce`, `#login-operario` y los tokens QR mantienen el módulo actual. Ambos espacios tienen acceso visible entre sí. La aplicación de gestión conserva Obras, Documentos, Personal, Otros gastos, Informes, copias y control horario históricos.

Se mantienen el proyecto/base Firebase existentes y las colecciones originales. No se migran datos, no se unen colecciones raíz con datos por usuario, no se alteran reglas ni se ejecutan restauraciones en producción. Un fallo de lectura muestra una alerta y acceso al inicio de sesión existente, en vez de interpretarse como ausencia de obras.

Se retiran del código recuperado el borrado automático de cachés por versión, la reproducción automática de la cola histórica, la migración automática de personal estructural y las escrituras automáticas de copias/avisos al montar. Las operaciones explícitas del usuario se conservan. Los estilos se limitan al espacio de gestión y comparten el tema guardado.

Validación: TypeScript y build; pruebas existentes más renderizado de la navegación de gestión con seis combinaciones de ancho/tema. Este renderizado no ejecuta efectos ni peticiones Firestore y no equivale a pruebas de navegador, login, datos reales ni dispositivos físicos. Debe verificarse en una vista previa que las obras/costes corresponden al propietario antes de publicar. Los bloqueos independientes del PR #6 siguen pendientes.
