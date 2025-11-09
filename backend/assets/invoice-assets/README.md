# Recursos de factura (logo, imágenes por defecto)

Coloca aquí recursos que usa la factura:

- `logo.png`: logo para el encabezado y la marca de agua.
- `default-product.png`: miniatura por defecto cuando un producto no tiene imagen.

Cómo configurar:
- Edita `backend/assets/company.json` y define:
  - `logo_path`: `assets/invoice-assets/logo.png`
  - `default_product_image`: `assets/invoice-assets/default-product.png`

Si estos archivos no existen, el generador usará un texto de fallback para la marca de agua y omitirá la miniatura.