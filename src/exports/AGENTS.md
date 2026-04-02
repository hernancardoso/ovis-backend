# AGENTS.md para `ovis-backend/src/exports/`

Esta guía aplica al módulo de exports de Athena/S3.

## Propósito

- Crear exports desde `iot_raw.collar_messages`.
- Soportar CSV en modo `QUERY_RESULTS` o `UNLOAD`.
- Soportar JSON en modo `UNLOAD`.
- Soportar `JSON + singleFile` generando un único archivo `NDJSON/.jsonl` a partir de múltiples parts de Athena.

## Archivos relevantes

- `exports.service.ts`
  - arma queries de Athena
  - consulta Glue para conocer tipos de columnas
  - calcula costo estimado
  - lista archivos de salida
  - hace merge de JSON a `.jsonl` cuando `format=JSON` y `singleFile=true`
- `exports.controller.ts`
  - expone `POST /exports`, `GET /exports/:jobId/status`, `GET /exports/:jobId/files`
- `dto/create-export.dto.ts`
  - contrato de entrada para crear exports

## Modos de export actuales

### CSV + multiple files

- Usa `UNLOAD`.
- Serializa columnas complejas con `json_format(CAST(col AS JSON))`.
- Serializa escalares con `CAST(col AS VARCHAR)` o `COALESCE(col, '')`.

### CSV + single file

- Usa `SELECT` normal.
- Athena deja un solo archivo en `ResultConfiguration.OutputLocation`.
- Sigue siendo el único modo que usa `QUERY_RESULTS`.

### JSON + multiple files

- Usa `UNLOAD` con `format = 'JSON'`.
- No castea columnas a varchar.
- Athena escribe múltiples archivos JSON.

### JSON + single file

- También usa `UNLOAD` con `format = 'JSON'`.
- Después del `SUCCEEDED` de Athena, el backend une los parts en:
  - `exports/{jobId}/merged/export_{jobId}.jsonl`
- El archivo final se sube con `multipart upload` a S3.
- El tamaño de parte configurado hoy es `8 MB`.
- Mientras ese merge corre, el status sigue reportándose como `RUNNING`.
- Recién cuando el merge termina, `GET /files` devuelve una sola URL.

## Decisiones importantes

### Tipos complejos para CSV

- Athena falla si se intenta `CAST(array(...) AS VARCHAR)` o `CAST(map(...) AS VARCHAR)`.
- Por eso el servicio consulta tipos reales en Glue y para tipos complejos usa:
  - `json_format(CAST(col AS JSON))`

### JSON single-file = NDJSON, no JSON array

- El archivo único de JSON se genera como `NDJSON/.jsonl`.
- Cada línea es un JSON independiente.
- Esto evita cargar todo en memoria y permite streaming.
- La implementación actual no usa `PutObject` streaming directo a S3 porque ese modo generó errores con headers/checksums en runtime.
- En su lugar, acumula chunks en memoria y los sube por partes con multipart upload.

### Orden global

- Athena `UNLOAD` escribe archivos en paralelo.
- Unir esos archivos no garantiza orden global estricto entre parts.
- Si se necesita orden global fuerte en un único archivo, esta estrategia no alcanza.

## Post-processing del job

El job mantiene metadatos adicionales en memoria:

- `singleFile`
- `postProcessing`
  - `NONE`
  - `JSONL_MERGE`
- estados:
  - `NOT_REQUIRED`
  - `PENDING`
  - `RUNNING`
  - `SUCCEEDED`
  - `FAILED`

Esto solo vive en memoria, igual que el resto del `jobStore`.

## S3 y permisos necesarios

Para el merge JSONL el backend necesita sobre el bucket de exports:

- `s3:ListBucket`
- `s3:GetObject`
- `s3:PutObject`
- `s3:HeadObject`
- `s3:DeleteObject`

## Restricción UI actual

Hoy la restricción de “solo JSON + single file” quedó como constante local en:

- `ovis-web/components/Export/AthenaExportTab.tsx`

Eso hace que:

- el frontend oculte el selector de formato/modo
- el request salga siempre como `format=JSON`
- el request salga siempre como `singleFile=true`

Importante:

- esto hoy es una restricción de UI, no una validación forzada en backend
- si alguien llama `POST /exports` manualmente, el backend sigue aceptando otros formatos/modos

## Guardrails

- No volver a aplicar `CAST(... AS VARCHAR)` a arrays/maps/structs para CSV.
- No convertir JSON single-file a “array JSON gigante” sin revisar memoria y streaming.
- No volver a `PutObject` con stream sin revisar compatibilidad del runtime/SDK/proxy de producción.
- No asumir persistencia del `jobStore`; si el proceso reinicia, los jobs se pierden.
- No eliminar el filtrado de metadata/manifests de Athena al listar archivos.
- Antes de cambiar content types o extensiones, revisar el front y las URLs firmadas.
- Si cambiás el merge `.jsonl`, mantenelo incremental; no bajes 1 GB completo a memoria.

## Qué validar si tocás este módulo

- CSV con columnas escalares.
- CSV con columnas `array` y `map`.
- JSON múltiple.
- JSON single-file y polling del status mientras se hace el merge.
- Regeneración de URLs firmadas con `files/refresh`.

## Documento complementario

- `docs/jsonl-single-file-exports.md`
