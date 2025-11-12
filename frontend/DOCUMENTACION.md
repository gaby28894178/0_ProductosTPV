# Documentación Frontend

## Resumen

Aplicación React (Vite) para gestión de ventas, productos, clientes, gastos, empleados, configuración y facturas.

## Requisitos

- Node.js 18+
- Variables de entorno en `frontend/.env` (opcional):
  - `VITE_API_URL` (por defecto `http://localhost:3001/api`)

## Desarrollo

- Ejecutar `npm install` y luego `npm run dev` en la carpeta `frontend`.
- Abrir la URL que indique Vite (por ejemplo `http://localhost:5173/`).

## Estructura principal

- `src/App.jsx`: rutas y layout principal.
- `src/components/Nav.jsx`: barra de navegación.
- `src/pages/*`: páginas principales:
  - `Dashboard`, `Productos`, `Ventas`, `Clientes`, `Gastos`, `Empleados`, `Config`, `Facturas`, `Facturacion`, `Auth`.
- `src/api.js`: instancia Axios con interceptor de token.

## Autenticación

- Página `Auth` para login y registro. El token se guarda en `localStorage` y se aplica a todas las requests.

## Clientes (nuevo)

- Página `Clientes`:
  - Crear, editar y eliminar clientes.
  - Visualizar `email` y `teléfono`.
  - Selección múltiple y envío masivo de emails (requiere SMTP configurado en backend).
  - Modal de envío de publicidad: asunto, mensaje (HTML), correos adicionales y adjunto de imagen (folleto). Muestra los destinatarios antes de enviar y luego los correos a los que se envió.

## Navegación

- Navbar con estilo Bootstrap `navbar-dark bg-primary bg-gradient`.
- Ítems ordenados alfabéticamente después de `Dashboard`.

## Facturación

- Visual de ventas y descarga de PDF desde backend.

## Buenas prácticas

- Evitar recargar toda la app; usar rutas y estado local.
- Manejar errores de API mostrando mensajes claros.

## Gastos y pagos

- Página `Gastos` permite registrar gastos y pagos.
  - Campos: `Tipo de gasto`, `Descripción`, `Monto`.
  - Tipos disponibles:
    - `gasto` (general), `construccion`, `vehiculo`, `insumo_mayorista`, `insumo_minorista`, `oficina`, `electronicos_oficina`, `herramientas`, `servicios`, `consumos`, `varios`, `pago_proveedor`, `pago_empleado`.
  - Acciones: agregar y eliminar.

### Categorías de gastos (Dashboard)

El Dashboard muestra una torta con cuatro categorías de gastos, cada una con color:

- Rojo (operativos): `gasto`, `consumos`, `varios`, `servicios`.
- Amarillo (proveedores): `pago_proveedor`, `insumo_mayorista`, `insumo_minorista`.
- Lila (personal): `pago_empleado`, `electronicos_oficina`.
- Naranja (infraestructura): `construccion`, `vehiculo`, `herramientas`, `oficina`.

Nota: si un tipo no aparece en la lista, se contabiliza como operativos (rojo) por defecto.

### Capital reingresado y porcentaje invertido

- En el Dashboard, la tarjeta "Capital invertido" muestra el porcentaje invertido (`totalGastos / (capitalInicial + capitalExtra)`) con barra gris.
- Botón "Re ingresar capital" permite sumar más capital (se guarda en `capitalExtra`).
- Selector de período (`Día/Semana/Mes`) al lado del botón.

## Mayorista

- Formulario de ingreso para productos mayoristas con generación de nombre por empaque y capacidad.
- Validaciones requeridas: `Nombre base`, `Capacidad (>0)`, `Stock (entero ≥0)`, `Precio mayorista` y `Precio público`.
- La grilla lista solo productos mayoristas (`esMayorista=true`) y se actualiza automáticamente al crear/editar/eliminar.
- Acciones en la grilla:
  - Editar: permite actualizar `nombre`, `marca`, `descripcion`, `unidad (litro/kilo)`, `stock`, `precioMayorista`, `precioPublico`.
  - Eliminar: elimina el producto.
- Búsqueda y orden:
  - Buscar por `nombre`, `marca` o `ID`.
  - Ordenar por `ID` o `fecha (createdAt)`, asc/desc.

## Productos (minorista)

- Listado y alta de productos no mayoristas.
- Se pide explícitamente al backend `GET /products?includeMayorista=false` y se filtra en frontend para asegurar que no aparezcan mayoristas.
- Búsqueda y orden con la misma UI que Mayorista.

## Estilos de grilla

- Clase `tabla-productos` para tablas: encabezado azul con texto blanco, filas alternadas y efecto hover.
- Soporta modo oscuro con ajuste de contraste.

## Lanzador (.bat)

- En la raíz del proyecto hay un lanzador `Abrir_App.bat` que:
  - Cierra puertos ocupados antes de iniciar (Backend `3001`, Frontend `5173..5185`, Preview `5500`).
  - Inicia `npm run dev` en `backend` y `frontend` en dos consolas separadas.
  - Abre automáticamente el primer puerto de Vite disponible (normalmente `http://localhost:5173/`).
  - Si no detecta Vite, hace fallback a `http://localhost:5173/`.

 - Backend por defecto escucha en `http://localhost:3001` (configurable con `PORT` en `backend/.env`).

## Presupuesto: IVA

- En `Presupuesto` se agregó control de IVA:
  - Checkbox para activar/desactivar.
  - Input para definir el porcentaje (por defecto 21% o el valor de `tax_rate` en `company.json`).
- Los badges del carrito muestran `Subtotal`, `IVA` y `Total` en tiempo real.
- Al generar PDF:
  - Se guarda `{ conIva, ivaPct }` en `localStorage` bajo `presupuestoIva`.
  - `BoletaPreview` lee esa configuración y calcula `Subtotal`, `IVA` y `Total` para el documento impreso.
  - La impresión se realiza en iframe oculto sin salir de la página.