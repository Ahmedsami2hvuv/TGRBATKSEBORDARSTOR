/** سطر صغير جداً تحت الصورة — آخر من رفع هذه النسخة */
export function ImageUploaderCaption({ name }: { name: string | null | undefined }) {
  const t = name?.trim();
  if (!t) return null;
  return (
    <p
      className="mt-0.5 max-w-full truncate text-[9px] leading-tight text-slate-400 sm:text-[10px]"
      dir="rtl"
      title={t}
    >
      رافع: {t}
    </p>
  );
}
