# Frontend (React + Vite) - CleanPro

Aplicación SPA con React Router que consume la API y permite gestionar productos, ventas y facturas.

## Páginas principales

- `Dashboard`: resumen de actividad
- `Productos`: alta/edición de productos (unidad `litro|kilo`, precios y stock)
- `Ventas`: carrito, selección de cliente/envío, IVA y generación de factura
- `Facturas`: listado de PDFs generados, abrir/regenerar y botón para borrar todos
- `Clientes`: gestión de clientes
- `Config`: opciones generales
- `Mayorista`: ingreso rápido de productos por paquete/balde/bidón (nueva)

## Mayorista (nueva sección)

- Formulario para cargar productos mayoristas por tipo de empaque:
  - Pastas: `Paquete` o `Balde` → unidad `kilo`
  - Líquidos: `Bidón` → unidad `litro`
- La capacidad (Kg/L) se utiliza para construir el nombre del producto.
- Envía `POST /api/products` con: `nombre`, `descripcion`, `unidad`, `marca`, `stock`, `precioMayorista`, `precioPublico`.

## IVA en la UI

- Se muestra según `tax_rate` del backend (`assets/company.json`).
- No se muestra como Exento si el checkbox de IVA está activo; se usa el porcentaje por defecto cuando falta.

## SweetAlert2

- Se usa un helper centralizado en `src/components/swal.js` para notificaciones, confirmaciones y prompts.

## Desarrollo

- Iniciar: `npm run dev` (Vite) → abre `http://localhost:5173` o el siguiente puerto disponible.
- Base de API configurable en `src/api.js` y `.env`.
