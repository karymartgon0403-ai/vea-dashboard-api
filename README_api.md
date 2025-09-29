# VEA Dashboard API

Contrato **OpenAPI** (`openapi.yaml`) y colección **Postman** (`postman_collection.json`) para el dashboard VEA/SINAT.

---

## 1) Subir a GitHub (vía web)

**No uses “Import repository”** (pide una URL de otro repo). En su lugar:

1. En GitHub, arriba a la derecha, **+ → New repository**.
2. Nombre: `vea-dashboard-api` (o el que prefieras). Visibilidad: **Private** (recomendado) o Public.
3. Crear el repo (opcional: agrega un README vacío).
4. Dentro del repo: **Add file → Upload files** y selecciona:
   - `openapi.yaml`
   - `postman_collection.json`
   - (opcional) `README_api.md` (este archivo), `schema_changes.sql`, `inventario_bd_vea.md`, carpeta `sql_extracts/`
5. **Commit changes**.

Estructura sugerida:
```
vea-dashboard-api/
├─ openapi.yaml
├─ postman_collection.json
├─ README_api.md
├─ schema_changes.sql              (opcional)
├─ inventario_bd_vea.md            (opcional)
└─ sql_extracts/                   (opcional)
```

---

## 2) Usar en Postman

1. Abre Postman → **Import → File** y elige `postman_collection.json`.
2. Crea un **Environment** `VEA-Dev` con variables:
   - `baseUrl` = `https://api.vea.local` *(o tu URL real)*
   - `token` = *(déjalo vacío si aún no hay backend)*
   - `desde` = `2025-08-01T00:00:00Z`
   - `hasta` = `2025-09-01T00:00:00Z`
3. (Opcional) En la request **Auth – Login → Tests**, pega:
   ```js
   if (pm.response.code === 200) {
     const j = pm.response.json();
     if (j.access_token) pm.environment.set('token', j.access_token);
   }
   ```
4. Ejecuta las requests (**Usuarios**, **Trámites**, **Notificaciones**, **KPI**).

**Mock rápido:** En la colección → `...` → **Mock collection**. Guarda la URL del mock y ponla en `baseUrl`.

---

## 3) Validar OpenAPI

- Abre `openapi.yaml` en **editor.swagger.io** (o Swagger UI).
- Debes ver todos los endpoints y schemas sin errores.

---

## 4) Trazabilidad endpoint → SQL (resumen)

- `GET /api/usuarios` → `vea.usuario` (select con filtros básicos).
- `GET /api/tramites` y `/api/tramites/{tramite_id}` → `vea.tramite_historico`.
- `GET /api/notificaciones` → `vea.turno_notificacion`.
- `GET /api/kpi/notificaciones-status-dia` → `mart.mv_notificaciones_status`.
- `GET /api/kpi/tramites-status-dia` → `mart.mv_tramites_status`.

> Nota: El contrato incluye `x-sql-example` por path con SQL orientativo.

---

## 5) CLI (opcional) subir a GitHub

```bash
git init
git branch -M main
git add openapi.yaml postman_collection.json README_api.md
git commit -m "API contract and Postman collection"
git remote add origin https://github.com/<tu_usuario>/<tu_repo>.git
git push -u origin main
```

---

## 6) Siguientes pasos

- Integrar tu backend con estos endpoints (token Bearer/JWT).
- Automatizar build de Swagger UI (Docker o CI) y publicar `openapi.yaml`.
- Mantener `postman_collection.json` alineado con cambios del contrato.
