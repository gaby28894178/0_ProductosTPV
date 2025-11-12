// Resuelve rutas de imagen/asset para apuntar al backend (http://localhost:3001/assets/**)
// Acepta: data URLs, URLs absolutas, o rutas relativas tipo "assets/product-images/foo.png"
export function resolveAssetUrl(url) {
  if (!url) return null;
  const s = String(url);
  if (s.startsWith('data:')) return s; // base64 embebida
  if (/^https?:\/\//i.test(s)) return s; // absoluta ya OK
  // Caso ruta relativa del repo/servidor: "assets/..."
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const backendOrigin = apiBase.replace(/\/api$/, '');
  const cleaned = s.replace(/^\/+/, '');
  return `${backendOrigin}/${cleaned}`;
}

// Convierte una URL (resuelta) en dataURL para insertar en PDF
export async function toDataUrlFromUrl(url) {
  if (!url) return null;
  const s = String(url);
  // Si ya es un data URL, devolverlo sin intentar fetch
  if (s.startsWith('data:')) return s;
  const abs = resolveAssetUrl(url);
  if (!abs) return null;
  const res = await fetch(abs).catch(()=> null);
  if (!res || !res.ok) return null;
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

export function getImageFormatFromDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(.*?);/);
  const mime = m?.[1] || '';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
  return 'PNG';
}