# Debug Session: nest-startup-hang

Status: OPEN

## Síntoma
- La aplicación Nest arranca módulos e imprime logs de `InstanceLoader`, pero aparentemente se queda detenida después de `TypeOrmModule dependencies initialized`.

## Hipótesis iniciales
- Algún `onModuleInit` o `onApplicationBootstrap` queda esperando una promesa que no resuelve.
- Un proveedor ejecuta una consulta a base de datos o servicio externo durante el arranque y queda bloqueado sin timeout visible.
- El servidor HTTP sí está levantando, pero falta el log de listening y el proceso parece colgado por configuración de logger o bootstrap.
- Hay un guard, servicio o scheduler inicializado al arrancar que depende de un recurso legacy y deja el event loop ocupado.
- Una conexión secundaria de TypeORM o un provider async se inicializa parcialmente y nunca termina de resolver.

## Evidencia
- Pendiente.

## Próximos pasos
- Revisar `main.ts`, `app.module.ts` y hooks de inicialización.
- Buscar `onModuleInit`, `onApplicationBootstrap`, `app.listen`, cron jobs y proveedores async.
- Instrumentar el bootstrap si la revisión estática no basta para ubicar el punto exacto de bloqueo.
