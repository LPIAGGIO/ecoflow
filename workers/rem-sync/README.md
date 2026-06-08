# rem-sync

Worker que automatiza la actualizacion mensual del **REM** (Relevamiento de
Expectativas de Mercado del BCRA) en la tabla Supabase `rem_forecasts`. Antes se
cargaba a mano leyendo el Excel con Excel COM.

## Que hace

1. Busca el xlsx oficial mas reciente caminando hacia atras desde el mes
   corriente (maneja el lag de ~1 mes con el que se publica el REM).
   URL real:
   `https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/tablas-relevamiento-expectativas-mercado-{mes}-{anio}.xlsx`
   (mes en abreviatura espaniola de 3 letras: `may`, no `mayo`).
2. Parsea la hoja "Cuadros de resultados" con la lib `xlsx`:
   - "Tipo de cambio nominal" -> `variable=tipo_cambio` (mediana $/USD por mes)
   - "Precios minoristas (IPC nivel general...)" -> `variable=ipc` (mediana var % mensual)
   - Solo filas mensuales (col Periodo = serial Excel fin de mes); descarta los
     agregados anuales ("2026", "prox. 12 meses", "Trim. I-26").
3. UPSERT idempotente en `rem_forecasts` por `(variable, period_date)` con
   `survey="{mes}-{anio}"`, y borra las filas de encuestas viejas.

Lo consume `/api/bcra-rem` (proxy) -> curva DLR (detector de basis "vs REM") y
modulo Carry Trade.

## Correr a mano

```bash
node worker.js                 # detecta y carga el REM mas reciente
SURVEY=may-2026 node worker.js # forzar una encuesta puntual / backfill
```

## Schedule (PM2)

`cron_restart: "0 12 4,7,10,14 * *"` — 12:00 ART los dias 4, 7, 10 y 14 de cada
mes. Idempotente: repetir con la misma encuesta es un no-op; en cuanto aparece
la nueva, la levanta.

## Env (.env)

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```
