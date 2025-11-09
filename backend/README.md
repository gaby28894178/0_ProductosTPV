# Backend (API) - CleanPro

Este backend expone la API para productos, ventas, facturas y clientes. Usa Express + Sequelize (SQLite por defecto) y genera facturas en PDF.

## Configuración de IVA y empresa

- Archivo: `assets/company.json`
- Claves importantes:
  - `name`: nombre de la empresa que aparece en la factura
  - `tax_rate`: porcentaje de IVA por defecto (ej.: `21`), usado como fallback si el cliente marca IVA y no especifica otro valor
  - `address`, `phone`, `email`: datos que se imprimen en el PDF

Ejemplo:

```json
{
  "name": "CleanPro",
  "tax_rate": 21,
  "address": "Calle Falsa 123",
  "phone": "+54 11 5555-5555",
  "email": "ventas@cleanpro.com"
}
```

## Colocación del IVA en factura

- El cálculo del IVA se realiza en `src/utils/invoice.js`.
- Si la venta viene con `applyTax=true` y `taxRatePercent` inválido/0, se usa `company.tax_rate` o `21` como respaldo.
- El total detallado del PDF muestra Subtotal, IVA y Total.

## Modelos principales

- `Product`: { id, nombre, descripcion, unidad(`litro|kilo`), marca, stock, precioMayorista, precioPublico }
- `Sale`: cabecera de venta (cliente/destino, totales)
- `SaleItem`: ítems de la venta (producto, cantidad, precio)

## Rutas

- Autenticación
  - `POST /api/auth/login`
- Productos
  - `GET /api/products`
  - `POST /api/products` (crear producto)
  - `PUT /api/products/:id`
  - `DELETE /api/products/:id`
- Ventas
  - `GET /api/sales`
  - `POST /api/sales` (crear venta)
  - `GET /api/sales/:id/invoice` (regenerar/abrir PDF de la venta)
- Facturas (archivos PDF generados)
  - `GET /api/invoices` (listar PDFs)
  - `DELETE /api/invoices` (eliminar todos los PDFs; no borra ventas)
- Clientes
  - `GET /api/clients`
  - `POST /api/clients`

## Envió de datos en ventas

Ejemplo `POST /api/sales`:

```json
{
  "items": [{ "productId": 1, "cantidad": 2, "precio": 1500 }],
  "bill_to": { "nombre": "Juan", "direccion": "Av. Siempreviva" },
  "ship_to": { "nombre": "Depósito", "direccion": "Ruta 3" },
  "applyTax": true,
  "taxRatePercent": 21
}
```

## Desarrollo y ejecución

- Variables de entorno: `.env` (puerto y base de datos)
- Desarrollo: `npm run dev` (nodemon) → API escucha en `http://localhost:55000` por defecto