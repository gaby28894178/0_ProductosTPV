// Capitaliza cada palabra: primera letra en mayúscula, resto en minúscula
export function capitalizeWords(input) {
  const s = String(input || '')
  return s.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}