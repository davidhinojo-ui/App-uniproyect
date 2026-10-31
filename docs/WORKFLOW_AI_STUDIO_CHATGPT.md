# UniProyect — trabajo compartido ChatGPT + Google AI Studio

Este repositorio es el punto de intercambio de codigo entre Google AI Studio y ChatGPT.

## Primera conexión (debe hacerse desde AI Studio)
1. Abre **el proyecto UniProyect original** en Google AI Studio, modo Build.
2. Abre **Settings > GitHub** y conecta tu cuenta `davidhinojo-ui`.
3. Vincula el proyecto existente con `davidhinojo-ui/App-uniproyect`.
4. Verifica que la fuente en AI Studio sea la version mas reciente. Guarda una copia/exportacion de respaldo antes del primer push.
5. Realiza **Push** del codigo de UniProyect a GitHub desde AI Studio y comprueba que el arbol de `main` contiene `package.json`, `src/` y el resto de la app.
6. **No copies a GitHub secretos**, credenciales de servicio, archivos `.env` privados ni datos personales.

## Editar desde ChatGPT
- Pide el cambio sobre `davidhinojo-ui/App-uniproyect`.
- Antes de cada cambio ChatGPT revisara el HEAD de `main` y PR abiertos.
- Cada cambio ira a una rama `feat/... ` o `fix/...` y un PR revisable.
- Tras probar, fusiona solo con aprobacion expresa. No se debe publicar por el mero hecho de fusionar.
- **Antes de volver a editar en AI Studio**, usa **Pull** en Settings > GitHub para actualizar su copia.

## Editar desde AI Studio
- Antes de editar, usa **Pull** para recibir cambios externos de GitHub.
- Trabaja y prueba en AI Studio.
- Usa **Push** al terminar; comprueba commit y rama publicados.
- Avisa en ChatGPT para que trabaje sobre el ultimo commit.
- Si aparece un conflicto, resuelvelo revisando la diferencia archivo por archivo; nunca reemplaces toda la app a ciegas.

## Reglas de concurrencia
- GitHub es el registro comun, **no** un editor en vivo; dos sesiones no comparten estado hasta Push/Pull.
- No editar simultaneamente los mismos archivos sin acuerdo.
- Mantener cambios acotados y pruebas antes de integrar.
- Aislar entornos y datos de prueba; no desplegar reglas Firestore sin verificar seguridad y permisos en emulador.
- No fusionar PR ni desplegar a produccion sin aprobacion expresa.
- Antes de publicar: build, pruebas, permisos Firebase, ausencia de secretos y plan de vuelta atras.

## Estado de arranque
Al redactar este procedimiento, `main` contiene solo README inicial. La sincronizacion de **la app real** desde AI Studio todavia debe efectuarse en el panel de Google AI Studio.

Documentacion: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
