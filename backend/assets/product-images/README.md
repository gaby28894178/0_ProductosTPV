# Carpeta de imágenes de productos

Coloca aquí las imágenes de tus productos para que puedan mostrarse en las facturas PDF.

Cómo usar:
- Guarda las imágenes con nombres simples, por ejemplo: `lavandina.png`, `detergente.jpg`.
- En la base de datos, en el campo `Product.imagenUrl`, asigna la ruta relativa: `assets/product-images/lavandina.png`.
- El generador de factura acepta tanto rutas locales (como esta carpeta) como URLs HTTP/HTTPS.

Notas:
- Si una imagen no existe o falla la descarga, se usa una imagen por defecto configurada en `backend/assets/company.json` (`default_product_image`).
- Formatos soportados habituales: PNG, JPG/JPEG, SVG.