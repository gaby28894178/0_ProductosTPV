# 0_ProductosTPV

## Inicio rápido

- Usá `Abrir_App.bat` en la raíz para iniciar backend y frontend.
- El script cierra puertos ocupados antes de iniciar:
  - Backend: `3001`
  - Frontend: `5173..5185`
  - Preview: `5500`
- Abre el navegador en el primer puerto de Vite disponible (normalmente `http://localhost:5173/`).

## Puertos

- Backend (API): `http://localhost:3001` (configurable con `PORT` en `backend/.env`).
- Frontend (Vite dev): `5173` por defecto; puede elegir uno libre entre `5173..5185`.

## IVA en Presupuesto

- En la vista `Presupuesto` se puede activar/desactivar IVA y definir el porcentaje.
- El carrito muestra `Subtotal`, `IVA` y `Total` en vivo.
- Al generar el PDF, `BoletaPreview` aplica la misma configuración y refleja los totales con IVA.