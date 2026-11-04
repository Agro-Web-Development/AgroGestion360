/**
 * Reduce fotografías antes de subirlas o guardarlas sin conexión: lado mayor de
 * 1920 px en JPEG al 82 %. Una foto de celular de 4–8 MB queda en ~300–600 KB,
 * lo que acelera la carga con señal débil y ahorra almacenamiento. Si el
 * navegador no puede decodificar el formato (p. ej. HEIC fuera de Safari) o el
 * resultado no es menor, se conserva el archivo original.
 */
const MAX_SIDE = 1920
const QUALITY = 0.82

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function" || typeof document === "undefined") return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified })
  } catch {
    return file
  }
}
