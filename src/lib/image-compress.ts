/**
 * Compresión de imágenes en el navegador, antes de subirlas.
 *
 * El caso real: un Android de gama baja saca fotos de 3–8 MB y el comerciante
 * sube seis por producto con datos móviles caros. Y del otro lado, el cliente
 * sube la captura del pago móvil desde el navegador embebido de Instagram.
 * Mandar el File tal cual es la diferencia entre dos segundos y un minuto.
 *
 * Redimensiona con canvas al lado mayor pedido y reencoda a JPEG bajando la
 * calidad hasta entrar en el techo de bytes. Si algo falla —canvas bloqueado,
 * formato que el navegador no decodifica, HEIC en un Android viejo— devuelve el
 * archivo original: comprimir es una optimización, nunca un motivo para que el
 * usuario no pueda subir su comprobante.
 */

export interface CompressOptions {
  /** Lado mayor de la imagen resultante, en píxeles. */
  maxEdge?: number;
  /** Techo de bytes al que se intenta llegar bajando calidad. */
  maxBytes?: number;
  /** Calidad JPEG inicial (0–1). Va bajando si no entra en maxBytes. */
  quality?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 1600,
  maxBytes: 300 * 1024,
  quality: 0.82,
};

/** Calidades que se prueban en orden hasta entrar en el techo de bytes. */
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.42];

/** Los PNG chicos (logos, capturas con texto) no ganan nada al pasar a JPEG. */
const SKIP_BELOW_BYTES = 120 * 1024;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("no se pudo decodificar la imagen"));
    };
    img.src = url;
  });
}

/** Reemplaza la extensión del nombre por .jpg, conservando el resto. */
function toJpgName(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.jpg`;
}

/**
 * Devuelve una versión liviana del archivo, o el mismo archivo si no hace
 * falta comprimirlo o si el navegador no pudo.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const { maxEdge, maxBytes, quality } = { ...DEFAULTS, ...options };

  if (!file.type.startsWith("image/")) return file;
  // Los GIF pueden estar animados y el canvas se queda con un solo cuadro.
  if (file.type === "image/gif") return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const img = await loadImage(file);
    const { width, height } = img;
    if (!width || !height) return file;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Fondo blanco: un PNG con transparencia sobre JPEG queda negro si no.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const steps = QUALITY_STEPS.filter((q) => q <= quality);
    let best: Blob | null = null;
    for (const q of steps.length > 0 ? steps : [quality]) {
      const blob = await canvasToBlob(canvas, q);
      if (!blob) continue;
      best = blob;
      if (blob.size <= maxBytes) break;
    }
    if (!best) return file;
    // Si comprimir no ganó nada (ya venía optimizada), se queda el original.
    if (best.size >= file.size) return file;

    return new File([best], toJpgName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** "2,4 MB" / "312 KB" — para mostrarle al usuario cuánto se ahorró. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}
