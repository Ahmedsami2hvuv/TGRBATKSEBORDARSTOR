/**
 * دالة لضغط الصور من هاتف الموظف قبل رفعها للسيرفر
 * تقوم بتقليل الدقة والضغط بنسبة عالية لتحويل الحجم من ميغابايت إلى كيلوبايتات ضئيلة جداً
 */
export async function compressImageFile(file: File, maxWidth = 800, maxPxHeight = 800, quality = 0.6): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // إذا لم تكن الصورة من نوع image، نرجع الملف كما هو
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxPxHeight) {
            width = Math.round((width * maxPxHeight) / height);
            height = maxPxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
