# Estilos de la boleta (invoice.css)

Este archivo documenta cómo ajustar los márgenes y tipografías de la boleta PDF sin modificar el código.

## Ubicación
- Archivo: `backend/assets/invoice-assets/invoice.css`

## Qué se puede ajustar

- Variables (custom properties) numéricas:
  - `--row-height`: alto de cada fila de ítems.
  - `--row-gap`: separación vertical entre filas.
  - `--desc-width`: ancho del bloque de título/descripcion.
  - `--qty-column-x`: posición X de la columna de cantidad.
  - `--amt-column-x`: posición X de la columna de monto.
  - `--amt-column-w`: ancho del bloque de monto.

- Clases reconocidas para `font-size`:
  - `.item-title` → tamaño del título del producto.
  - `.item-desc` → tamaño de la descripción del producto.
  - `.item-qty` → tamaño del número de cantidad.
  - `.item-amount` → tamaño del monto.

> Nota: actualmente el motor de PDFKit solo usa `font-size` de estas clases y las variables anteriores. Otras propiedades CSS no se aplican.

## Ejemplo

```css
:root {
  --row-height: 30;
  --row-gap: 2;
  --desc-width: 300;
  --qty-column-x: 440;
  --amt-column-x: 505;
  --amt-column-w: 65;
}

.item-title { font-size: 14; }
.item-desc { font-size: 8; }
.item-qty  { font-size: 10; }
.item-amount { font-size: 11; }
```

## Cómo se aplica

El backend lee `invoice.css` al generar el PDF y aplica los valores en tiempo de renderizado. Cambie los números, regenere la boleta (`node scripts/generate_test_invoice.js`) y verá el ajuste.

## Consejos

- Si el encabezado se corta, aumente `--desc-width` o mueva columnas con `--qty-column-x`/`--amt-column-x`.
- Si hay solapamiento vertical, incremente `--row-height` o `--row-gap`.
- Para que la cantidad destaque, suba `.item-qty { font-size: ... }`.