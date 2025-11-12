# Documentación Backend

## Resumen

API Express con Sequelize y SQLite por defecto. Provee endpoints para autenticación, productos, ventas, gastos, empleados, configuración, facturas, clientes y destinos.

## Requisitos

- Node.js 18+
- Variables `.env` en `backend/.env` (ver `backend/.env.example`).
- Puerto por defecto: `PORT=3001`.

## Configuración clave

- `DB_DIALECT=sqlite` (por defecto), soporte también para `mysql` y `postgres`.
- `JWT_SECRET` para autenticación.
- SMTP para envío masivo de emails:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

## Puesta en marcha

- Ejecutar `npm install` y `npm run dev` en `backend`.
- En el arranque se corre `sequelize.sync()` y una migración ligera para añadir columnas `email` y `telefono` en `Customers` si faltan.

## Endpoints principales

- `POST /api/auth/register` / `POST /api/auth/login`.
- `GET/POST/PUT/DELETE /api/products`.
- `POST /api/sales` crea venta y descuenta stock; `GET /api/sales` listado; `GET /api/sales/:id/invoice` PDF.
- `GET/POST/DELETE /api/expenses`.
- `GET/POST/DELETE /api/employees`; `POST /api/employees/:id/pagos` registra pago (gasto).
- `GET/PUT /api/config`.
- `GET /api/invoices` (según implementación existente).
- `GET/POST/PUT/DELETE /api/customers`.
- `POST /api/customers/bulk-email` envío masivo (BCC) de correo.
  - Request: `multipart/form-data` o JSON.
  - Campos: `ids` (array de IDs de clientes), `emails` (coma-separados opcional), `subject`, `html` o `text`, `folleto` (archivo imagen opcional).
  - Respuesta: `{ ok, messageId, count, recipients }` (incluye lista de correos destino).
- `GET/POST /api/destinations` (crear destino; el teléfono se usa solo en PDF por ahora).

## Notas de base de datos

- SQLite: rápido para desarrollo, no soporta bien `ENUM` dinámicos; se usan `STRING` para campos como tipo de gasto.
- Migración ligera: `backend/src/setup/migrations.js` añade columnas faltantes en `Customers`.
  - Añade también `capitalExtra` en `Configs` si falta.

## Archivos clave

- `src/server.js`: arranque del servidor y registro de rutas.
- `src/setup/database.js`: conexión Sequelize.
- `src/routes/*`: endpoints.
- `src/models/*`: modelos Sequelize.
- `src/utils/invoice.js`: generación de PDF de facturas.

## Seguridad

- Middleware `auth` con JWT en todas las rutas protegidas.

## Operación

- Los archivos de facturas se guardan en `backend/facturas/YYYY/MM/DD/`.

## Gastos

- Modelo `Expense`:
  - Campos: `id`, `tipo` (STRING, por defecto `gasto`), `descripcion`, `monto` (FLOAT), `fecha` (DATE, default NOW).
- Endpoints:
  - `GET /api/expenses`: listado.
  - `POST /api/expenses`: crear. Body esperado: `{ tipo, descripcion, monto, fecha? }`.
  - `DELETE /api/expenses/:id`: eliminar.

### Categorías de gastos usadas en el Dashboard

El agrupamiento de gastos en el Dashboard se realiza por `tipo` en cuatro categorías con colores:

- Rojo (operativos): `gasto`, `consumos`, `varios`, `servicios`.
- Amarillo (proveedores): `pago_proveedor`, `insumo_mayorista`, `insumo_minorista`.
- Lila (personal): `pago_empleado`, `electronicos_oficina`.
- Naranja (infraestructura): `construccion`, `vehiculo`, `herramientas`, `oficina`.

Tipos no contemplados explícitamente se agrupan como operativos (rojo).

## Configuración: capital

- `GET/PUT /api/config`: lectura y actualización de configuración (incluye `capitalInicial`, `capitalExtra`, `proyeccionSemanal`, `proyeccionMensual`).
- `POST /api/config/add-capital`: reingreso de capital.
  - Body: `{ monto }` (number > 0). Suma el monto a `capitalExtra`.

## Configuración: respaldo y reset

- `GET /api/config/backup`: descarga la base `data.sqlite` con el nombre configurado en `backupName`.
- `POST /api/config/restore` (binary): restaura la base desde un archivo `.sqlite` enviado como binario.
- `POST /api/config/reset`: limpia la base de datos (borra clientes, destinos, productos, ventas, gastos, empleados y usuarios) sin borrar el archivo físico.
  - Seguridad: la contraseña se define en `backend/assets/company.json` bajo la clave `reset_password`.
    - Enviar en el body `{ password: "<valor de reset_password>" }`.
    - Al guardar vía `PUT /api/company`, el backend almacena la contraseña de forma encriptada usando `scrypt` con sal.
      - Campos almacenados: `reset_password_hash` y `reset_password_salt`.
      - El backend NO devuelve estos campos ni la contraseña en texto plano en `GET /api/company`.
  - Mantiene la tabla `Configs` para no perder ajustes (capital, nombre de respaldo, etc.).
  - En SQLite, intenta resetear `sqlite_sequence` para reiniciar autoincrementos.

## Company: JSON

- `GET /api/company`: devuelve el contenido de `backend/assets/company.json` (incluye `reset_password`).
- `PUT /api/company`: actualiza campos permitidos del JSON. Actualmente:
  - `reset_password`: contraseña utilizada para confirmar el reseteo de la base. El backend la guarda como `hash + salt` (scrypt).
  - Body de ejemplo: `{ "reset_password": "nueva_clave_segura" }`.

## Productos: mayorista vs minorista

- Modelo `Product` incluye el campo booleano `esMayorista`.
- Endpoints `GET /api/products` aceptan el query `includeMayorista=true|false` para controlar la inclusión de productos mayoristas en el listado.
  - `includeMayorista=false`: retorna solo productos no mayoristas.
  - `includeMayorista=true`: incluye los mayoristas; se recomienda filtrar en frontend por `esMayorista` si se requiere estrictamente solo mayoristas.
- `POST /api/products`: crear producto (mayorista o minorista).
- `PUT /api/products/:id`: actualizar producto.
- `DELETE /api/products/:id`: eliminar producto.

## Notas de ordenamiento

- El orden por ID/fecha implementado en frontend utiliza `createdAt` y `id`. Si se requiere ordenamiento paginado en backend, añadir parámetros `sortField` y `sortDir` y aplicarlos en la consulta Sequelize.