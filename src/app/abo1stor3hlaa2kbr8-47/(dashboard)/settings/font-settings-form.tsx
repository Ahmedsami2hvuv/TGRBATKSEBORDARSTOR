"use client";

import { useState, useTransition, useRef } from "react";
import { saveChosenFontAction, uploadFontAction } from "./actions";

export function FontSettingsForm({
  availableFonts,
  currentFont
}: {
  availableFonts: string[],
  currentFont: string
}) {
  const [selectedFont, setSelectedFont] = useState(currentFont);
  const [isPending, startTransition] = useTransition();
  
  // حالات رفع خط جديد
  const [fontNameInput, setFontNameInput] = useState("");
  const [fontFileInput, setFontFileInput] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    startTransition(async () => {
      const res = await saveChosenFontAction(selectedFont);
      if (res.ok) {
        alert("تم تحديث الخط بنجاح! سيتم تطبيق التغيير على الموقع بالكامل.");
        window.location.reload();
      } else {
        alert("فشل تحديث الخط.");
      }
    });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!fontNameInput.trim()) {
      alert("يرجى كتابة اسم الخط.");
      return;
    }
    if (!fontFileInput) {
      alert("يرجى اختيار ملف الخط أولاً.");
      return;
    }

    startUploadTransition(async () => {
      const formData = new FormData();
      formData.append("fontName", fontNameInput.trim());
      formData.append("fontFile", fontFileInput);

      const res = await uploadFontAction(formData);
      if (res.ok) {
        alert(`تم رفع الخط "${res.fontName}" بنجاح وإضافته للموقع!`);
        // إعادة تهيئة النموذج
        setFontNameInput("");
        setFontFileInput(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // تنشيط الخط الجديد في الواجهة فوراً ليتم اختياره
        if (res.fontName) {
          setSelectedFont(res.fontName);
        }
        window.location.reload(); // لإعادة تحميل الخطوط المتاحة من المجلد
      } else {
        alert(res.error || "فشل رفع الخط.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* قسم اختيار الخطوط المتاحة */}
      <div className="grid grid-cols-1 gap-3">
        <label className="text-xs font-black text-slate-500 px-1">اختر الخط الأساسي للموقع</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedFont("system-ui")}
            className={`px-4 py-3 rounded-2xl border-2 transition-all text-sm font-bold text-center ${
              selectedFont === "system-ui"
                ? "border-slate-600 bg-slate-100 text-slate-900 shadow-md"
                : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
            }`}
          >
            الافتراضي ⚙️
          </button>
          {availableFonts.map((font) => (
            <button
              key={font}
              onClick={() => setSelectedFont(font)}
              className={`px-4 py-3 rounded-2xl border-2 transition-all text-sm font-bold text-center ${
                selectedFont === font
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100"
                  : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
              }`}
            >
              {font}
            </button>
          ))}
        </div>
      </div>

      {/* قسم معاينة الخط وحفظه */}
      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-slate-900 text-white">
          <p className="text-[10px] text-slate-400 mb-2 font-bold">معاينة الخط المختار:</p>
          <p
            className="text-xl font-preview-text"
            style={{ "--preview-font": selectedFont === "system-ui" ? "system-ui" : `'${selectedFont}'` } as any}
          >
            بسم الله الرحمن الرحيم - تجربة الخط المختار على واجهة النظام.
          </p>
        </div>

        <button
          disabled={isPending || selectedFont === currentFont}
          onClick={handleSave}
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 transition-all text-sm"
        >
          {isPending ? "جاري الحفظ..." : "حفظ الخط المختار كخط أساسي"}
        </button>
      </div>

      <hr className="border-slate-100 my-4" />

      {/* قسم إضافة خط مخصص جديد */}
      <div className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">✍️</span>
          <div>
            <h3 className="text-sm font-black text-slate-800">إضافة خط مخصص جديد</h3>
            <p className="text-[11px] text-slate-400 font-bold">يمكنك رفع ملف خط من جهازك وتطبيقه مباشرة</p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 px-1">اسم الخط</label>
            <input
              type="text"
              placeholder="مثال: Cairo Bold, Almarai..."
              value={fontNameInput}
              onChange={(e) => setFontNameInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-slate-700"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 px-1">اختر ملف الخط</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2,.eot,.svg,.ttc,.dfont"
              onChange={(e) => setFontFileInput(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 focus:outline-none transition-all font-bold text-slate-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isUploading || !fontNameInput || !fontFileInput}
            className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs disabled:opacity-50 disabled:hover:bg-slate-800 active:scale-95 transition-all shadow-md shadow-slate-100"
          >
            {isUploading ? "جاري رفع وإضافة الخط..." : "رفع وإضافة الخط 📤"}
          </button>
        </form>
      </div>

      <p className="text-[10px] text-slate-400 text-center font-bold">
        ملاحظة: تظهر الخطوط الموجودة في مجلد public/fonts تلقائياً، ويمكنك اختيارها وتطبيقها.
      </p>
    </div>
  );
}
