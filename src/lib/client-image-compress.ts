/**
 * تصغير صور الطلب على المتصفح قبل الرفع — أسرع وأخف على الخادم.
 * إن فشلت المعالجة يُعاد الملف الأصلي.
 */

export type CompressImageOptions = {
  /** أقصى طول للضلع الأطول (بكسل) */
  maxEdgePx?: number;
  /** جودة JPEG بعد إعادة الترميز (0–1) */
  jpegQuality?: number;
  /** إذا كانت الصورة أصغر من هذا الحجم (بايت) لا نعيد ترميزها */
  minBytes?: number;
  /**
   * قصّ مركزي إلى مربع 1:1 ثم تصغير الضلع إلى `maxEdgePx` كحد أقصى.
   * لا يمكن إجبار واجهة الكاميرا الأصلية على 1:1 من المتصفح؛ يُطبَّق بعد الالتقاط/الاختيار.
   */
  squareCrop?: boolean;
};

const DEFAULT_MAX = 1600;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MIN_BYTES = 400_000;

type ResolvedCompress = {
  maxEdgePx: number;
  jpegQuality: number;
  minBytes: number;
  squareCrop: boolean;
};

function resolveArgs(
  maxEdgePxOrOpts?: number | CompressImageOptions,
  jpegQuality?: number,
): ResolvedCompress {
  if (maxEdgePxOrOpts !== undefined && typeof maxEdgePxOrOpts === "object") {
    return {
      maxEdgePx: maxEdgePxOrOpts.maxEdgePx ?? DEFAULT_MAX,
      jpegQuality: maxEdgePxOrOpts.jpegQuality ?? DEFAULT_QUALITY,
      minBytes: maxEdgePxOrOpts.minBytes ?? DEFAULT_MIN_BYTES,
      squareCrop: maxEdgePxOrOpts.squareCrop ?? false,
    };
  }
  return {
    maxEdgePx: typeof maxEdgePxOrOpts === "number" ? maxEdgePxOrOpts : DEFAULT_MAX,
    jpegQuality: jpegQuality ?? DEFAULT_QUALITY,
    minBytes: DEFAULT_MIN_BYTES,
    squareCrop: false,
  };
}

/** يضع ملفاً واحداً في حقل `<input type="file">` لإرساله مع النموذج */
export function assignFileToInput(input: HTMLInputElement, file: File): void {
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
}

/**
 * إعدادات مناسبة لرفع المندوب (صورة محل / باب / طلبية) — تصغير + مربع 1:1 كما في عرض الصفحة.
 */
export function compressImageForMandoubUpload(file: File): Promise<File> {
  return compressImageFileForUpload(file, {
    maxEdgePx: 1600,
    jpegQuality: 0.78,
    minBytes: 60_000,
    squareCrop: true,
  });
}

export async function compressImageFileForUpload(
  file: File,
  maxEdgePxOrOpts?: number | CompressImageOptions,
  jpegQuality?: number,
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const { maxEdgePx, jpegQuality: q, minBytes, squareCrop } = resolveArgs(
    maxEdgePxOrOpts,
    jpegQuality,
  );
  if (minBytes > 0 && file.size < minBytes && !squareCrop) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (nw <= 0 || nh <= 0) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (squareCrop) {
        const side = Math.min(nw, nh);
        const sx = Math.floor((nw - side) / 2);
        const sy = Math.floor((nh - side) / 2);
        const outSide = side > maxEdgePx ? maxEdgePx : side;
        canvas.width = outSide;
        canvas.height = outSide;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, outSide, outSide);
      } else {
        let width = nw;
        let height = nh;
        if (width > maxEdgePx || height > maxEdgePx) {
          if (width > height) {
            height = Math.round((height * maxEdgePx) / width);
            width = maxEdgePx;
          } else {
            width = Math.round((width * maxEdgePx) / height);
            height = maxEdgePx;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "") || "order";
          const out = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
          resolve(out);
        },
        "image/jpeg",
        q,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
