# VEA Dashboard API — README

Este documento acompaña al contrato **OpenAPI** (`openapi.yaml`) y a la **colección Postman** (`postman_collection.json`).  
Incluye **trazabilidad** endpoint → SQL/MV/tablas, instrucciones de uso y un **checklist de entrega**.

---

## 0) Estructura sugerida del repositorio

```
vea-dashboard-api/
├─ openapi.yaml
├─ postman_collection.json
├─ README_api.md  ← este archivo
├─ schema_changes.sql              # cambios de esquema / MVs / índices (staging)
├─ inventario_bd_vea.md            # inventario de BD (v3)
└─ sql_extracts/                   # consultas SQL por indicador/KPI
```

---

## 1) Entornos y variables

- **Base URL**: `{{baseUrl}}` (ej. `https://api.vea.local` o URL del mock de Postman)
- **Auth**: `Authorization: Bearer {{token}}` (JWT/placeholder)
- **Fechas**: `{{desde}}`, `{{hasta}}` (RFC3339, `hasta` es exclusivo)

**Environment recomendado (Postman)**: `VEA-Dev`
```
baseUrl = https://api.vea.local
token   = (vacío si no hay backend)
desde   = 2025-08-01T00:00:00Z
hasta   = 2025-09-01T00:00:00Z
```

---

## 2) Trazabilidad endpoint → SQL/MV/tablas

### 2.1 Usuarios

**Endpoint**
```
GET /api/usuarios
```

**Origen de datos**
- Tabla: `vea.usuario`
- Columnas clave:  
  `usuario_id`, `rfc`, `curp`, `correo_electronico`, `razon_social`,  
  `f_registro`, `f_ultimo_login`

**SQL de referencia**
```sql
SELECT usuario_id, rfc, curp, correo_electronico, razon_social, f_registro, f_ultimo_login
FROM vea.usuario
WHERE (:q IS NULL OR razon_social ILIKE '%' || :q || '%' OR rfc ILIKE '%' || :q || '%')
ORDER BY usuario_id
LIMIT :limit OFFSET :offset;
```

---

### 2.2 Trámites (histórico de eventos)

**Endpoints**
```
GET /api/tramites
GET /api/tramites/{tramite_id}
```

**Origen de datos**
- Tabla: `vea.tramite_historico`
- Columnas clave:  
  `tramite_id`, `estatus_id`, `situacion_tramite_id`, `f_actualiza`

**Transformación**  
`estado` = `COALESCE(NULLIF(situacion_tramite_id,''), 'EST:' || estatus_id::text)`

**SQL de referencia**
```sql
SELECT tramite_id,
       COALESCE(NULLIF(situacion_tramite_id,''), 'EST:' || estatus_id::text) AS estado,
       f_actualiza AS fecha_evento
FROM vea.tramite_historico
WHERE (:estado IS NULL OR COALESCE(NULLIF(situacion_tramite_id,''), 'EST:' || estatus_id::text) = :estado)
  AND (:desde IS NULL OR f_actualiza >= :desde)
  AND (:hasta IS NULL OR f_actualiza <  :hasta)
ORDER BY f_actualiza DESC
LIMIT :limit OFFSET :offset;
```

**Detalle por trámite**
```sql
SELECT tramite_id, estatus_id, situacion_tramite_id, f_actualiza
FROM vea.tramite_historico
WHERE tramite_id = :tramite_id
ORDER BY f_actualiza;
```

---

### 2.3 Notificaciones

**Endpoint**
```
GET /api/notificaciones
```

**Origen de datos**
- Tabla: `vea.turno_notificacion`
- Columnas clave:  
  `turno_notificacion_id`, `estatus_turno_id`, `oficina_id`, `funcionario_publico_id`,  
  `f_notificacion`, `f_registro`

**Transformación**
- `notificacion_id` = `turno_notificacion_id`
- Fecha principal = `COALESCE(f_notificacion, f_registro)`

**SQL de referencia**
```sql
SELECT turno_notificacion_id AS notificacion_id,
       estatus_turno_id, oficina_id, funcionario_publico_id,
       f_notificacion AS fecha_notificacion, f_registro AS fecha_registro
FROM vea.turno_notificacion
WHERE (:estatus_turno_id IS NULL OR estatus_turno_id = :estatus_turno_id)
  AND (:oficina_id IS NULL OR oficina_id = :oficina_id)
  AND (:desde IS NULL OR COALESCE(f_notificacion, f_registro) >= :desde)
  AND (:hasta IS NULL OR COALESCE(f_notificacion, f_registro) <  :hasta)
ORDER BY COALESCE(f_notificacion, f_registro) DESC
LIMIT :limit OFFSET :offset;
```

---

### 2.4 KPIs (series agregadas)

#### 2.4.1 Notificaciones por día y estatus

**Endpoint**
```
GET /api/kpi/notificaciones-status-dia
```

**Origen de datos (MV)**
- MV: `mart.mv_notificaciones_status`  
  - Columnas: `estatus_turno_id`, `dia` (date), `total` (int)
- Fuentes: `vea.turno_notificacion`  
  - Agregación: `GROUP BY estatus_turno_id, date_trunc('day', COALESCE(f_notificacion, f_registro))`

**SQL de referencia**
```sql
SELECT estatus_turno_id, dia, total
FROM mart.mv_notificaciones_status
WHERE (:desde IS NULL OR dia >= :desde::date)
  AND (:hasta IS NULL OR dia <  :hasta::date)
ORDER BY dia, estatus_turno_id;
```

**Actualización MV (staging)**
```sql
REFRESH MATERIALIZED VIEW mart.mv_notificaciones_status;
-- Para cron: cada noche o cada X horas (según volumen)
```

---

#### 2.4.2 Trámites por día y estado

**Endpoint**
```
GET /api/kpi/tramites-status-dia
```

**Origen de datos (MV)**
- MV (propuesta): `mart.mv_tramites_status`  
  - Columnas: `estado`, `dia`, `total`
- Fuente: `vea.tramite_historico`  
  - Transformación `estado` (ver 2.2), `GROUP BY estado, date_trunc('day', f_actualiza)`

**SQL de referencia**
```sql
SELECT estado, dia, total
FROM mart.mv_tramites_status
WHERE (:desde IS NULL OR dia >= :desde::date)
  AND (:hasta IS NULL OR dia <  :hasta::date)
ORDER BY dia, estado;
```

> Nota: si aún **no existe** la MV `mart.mv_tramites_status`, usa una vista temporal en staging o deja el endpoint deshabilitado hasta contar con la MV.

---

## 3) Seguridad y contratos

- **Auth**: Bearer JWT (`bearerAuth` en `components.securitySchemes`)
- Todas las rutas (excepto `/auth/login` y `/auth/refresh`) requieren token.
- Respuestas de error: `components.responses.Unauthorized` + `components.schemas.Error`

---

## 4) Postman — uso rápido

1. **Importar** `postman_collection.json`.
2. **Crear Environment** `VEA-Dev` con `baseUrl`, `token`, `desde`, `hasta`.
3. (Opcional) En **Auth – Login → Tests**:
   ```js
   if (pm.response.code === 200) {
     const j = pm.response.json();
     if (j.access_token) pm.environment.set('token', j.access_token);
   }
   ```
4. Probar: **Usuarios – Listar**, **Trámites – Listar**, **Notificaciones – Listar**, **KPI – …**
5. **Mock**: colección → `…` → *Mock collection* → usa URL del mock como `baseUrl`.

---

## 5) Validación rápida del contrato

- Abrir `openapi.yaml` en **https://editor.swagger.io/**
- Debe renderizar sin errores; revisar:
  - Paths, parámetros y `schemas`
  - Ejemplos `x-sql-example` (solo documentación)
  - Seguridad `bearerAuth`

---

## 6) Rendimiento (staging)

- Índices sugeridos (si aplica):
  - `CREATE INDEX idx_tramite_historico_fecha ON vea.tramite_historico (f_actualiza);`
  - `CREATE INDEX idx_turno_notif_fecha ON vea.turno_notificacion (COALESCE(f_notificacion, f_registro));`
- MVs:
  - `mart.mv_notificaciones_status` **(creada)**
  - `mart.mv_tramites_status` **(propuesta)**

---

## 7) Checklist de entrega (DoD API)

- [ ] `openapi.yaml` validado en Swagger Editor (OpenAPI 3.0.3).
- [ ] `postman_collection.json` importable sin errores.
- [ ] `README_api.md` incluido en el repo.
- [ ] **Trazabilidad** endpoint → SQL/MV/tablas documentada (este archivo).
- [ ] **Evidencias** (opcional): capturas de DBeaver para:
  - `vea.usuario`, `vea.tramite_historico`, `vea.turno_notificacion`
  - `mart.mv_notificaciones_status` (conteos/filtrado por fecha)
- [ ] **Staging listo**:
  - Índices mínimos creados (si tienes permisos)
  - MV `mart.mv_notificaciones_status` creada y con `REFRESH` probado
  - (Opcional) MV `mart.mv_tramites_status` creada o planificada
- [ ] **Colección Postman** con environment `VEA-Dev` (variables definidas).
- [ ] (Opcional) **Mock de Postman** para demostraciones.
- [ ] Repo GitHub con:
  - `openapi.yaml`, `postman_collection.json`, `README_api.md`
  - (Opcional) `schema_changes.sql`, `inventario_bd_vea.md`, `sql_extracts/`

---

## 8) Notas

- Los `x-sql-example` del OpenAPI son **documentativos**; la app real puede usar funciones/ORM.
- Ajusta tipos/formatos según tu backend (ej. `date-time` vs `date`).
- Si tu BD es de **solo lectura**, ejecuta cambios solo en **staging**.
