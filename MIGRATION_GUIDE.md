# Guía de Migración Profesional - Arista Studio

## Estado Actual
- **Base de Datos:** Un solo campo `app_data` en la tabla `profiles`.
- **Riesgo:** Bloqueos por tamaño (Lock contention), dificultad para escalar, actualizaciones pesadas.

## Estrategia de Migración (Paso C)
1. **Modelado de Tablas:**
   - `inventory_aluminum`: Perfiles de aluminio.
   - `inventory_glass`: Vidrios.
   - `inventory_accessories`: Accesorios/Herrajes.
   - `inventory_panels`: Paneles ciegos.
   - `inventory_dvh`: Insumos para DVH.
   - `inventory_treatments`: Colores/Tratamientos.
   - `recipes`: Plantillas de productos.
   - `quotes`: Presupuestos generados.

2. **Proceso Técnico:**
   - Crear las tablas en Supabase.
   - Desarrollar un "Service Layer" que reemplace el guardado masivo por guardados específicos.
   - Script de importación para mover los datos del JSON de respaldo a las nuevas tablas.

## Medidas de Seguridad
- **Backup JSON:** El usuario debe descargar el archivo `RESPALDO_TECNICO_ARISTA_*.json` desde la pestaña "Base de Datos".
- **Rollback:** Si algo falla, el botón "Restaurar JSON" permite volver al estado anterior en segundos.
