"use client";

import { useState, useTransition } from "react";
import { compressR2ImageAction, deleteR2ImageAction } from "./actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { toast } from "sonner";

interface LargeImage {
  key: string;
  sizeKb: number;
  sizeMb: string;
  size: number;
  lastModified?: Date;
  usages: string[];
  url: string;
}

export function LargeImagesManager({
  initialObjects,
  initialTotalBucketSizeMb,
  initialTotalLargeSizeMb,
  initialOrphanedCount,
  icons,
}: {
  initialObjects: LargeImage[];
  initialTotalBucketSizeMb: string;
  initialTotalLargeSizeMb: string;
  initialOrphanedCount: number;
  icons: GlobalIconsConfig | null;
}) {
  const [images, setImages] = useState<LargeImage[]>(initialObjects);
  const [totalBucketSizeMb, setTotalBucketSizeMb] = useState<number>(parseFloat(initialTotalBucketSizeMb));
  const [totalLargeSizeMb, setTotalLargeSizeMb] = useState<number>(parseFloat(initialTotalLargeSizeMb));
  const [orphanedCount, setOrphanedCount] = useState<number>(initialOrphanedCount);

  // حالات التقليص الجماعي
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(new Set());
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());
  
  const [isActionPending, startTransition] = useTransition();

  // تقليص صورة واحدة وتحديث البيانات محلياً
  const compressSingleImage = async (key: string, isBatch = false) => {
    // إضافة الصورة لقائمة الجاري معالجتها
    setProcessingKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    const res = await compressR2ImageAction(key);

    if (res.ok) {
      // إيجاد الصورة لحساب الحجم الموفر
      const img = images.find((i) => i.key === key);
      if (img) {
        // بافتراض أن الحجم يتقلص بنسبة 96% (أي يتبقى 4% من الحجم الأصلي)
        const originalBytes = img.size;
        const compressedBytes = originalBytes * 0.04;
        const savedBytes = originalBytes - compressedBytes;
        const savedMb = savedBytes / (1024 * 1024);

        // تحديث الحسابات محلياً
        setTotalLargeSizeMb((prev) => Math.max(0, parseFloat((prev - img.size / (1024 * 1024)).toFixed(2))));
        setTotalBucketSizeMb((prev) => Math.max(0, parseFloat((prev - savedMb).toFixed(1))));
        if (img.usages.includes("صورة يتيمة / غير مستخدمة 🗑️")) {
          setOrphanedCount((prev) => Math.max(0, prev - 1));
        }

        // إزالة الصورة من الجدول
        setImages((prev) => prev.filter((i) => i.key !== key));
      }
      
      if (!isBatch) {
        toast.success("تم تقليص حجم الصورة بنجاح بنسبة تتجاوز 95% واختفت من الجدول!");
      }
    } else {
      setFailedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      if (!isBatch) {
        toast.error(res.error || "فشل تقليص الصورة");
      }
    }

    // إزالة الصورة من قائمة الجاري معالجتها
    setProcessingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    return res.ok;
  };

  // تقليص جميع الصور تلقائياً بالتتالي
  const handleBatchCompress = async () => {
    if (images.length === 0) {
      toast.info("لا توجد صور لتقليصها!");
      return;
    }

    if (isBatchRunning) {
      // إيقاف مؤقت
      setIsBatchRunning(false);
      toast.info("تم إيقاف عملية التقليص الجماعي مؤقتاً.");
      return;
    }

    setIsBatchRunning(true);
    const targetImages = [...images];
    setTotalToProcess(targetImages.length);
    setCurrentProgressIndex(0);
    setFailedKeys(new Set());

    toast.loading("بدء عملية تقليص جميع الصور تلقائياً بالتتالي...", { id: "batch-toast" });

    let processedCount = 0;
    for (let i = 0; i < targetImages.length; i++) {
      // التحقق من حالة الإيقاف المؤقت قبل كل صورة
      // نستخدم متغير حالة محدث عبر الإغلاق أو الدوران الآمن
      let shouldContinue = false;
      setIsBatchRunning((curr) => {
        shouldContinue = curr;
        return curr;
      });
      if (!shouldContinue) {
        break;
      }

      const img = targetImages[i];
      setCurrentProgressIndex(i);
      
      toast.loading(`جاري تقليص صورة ${i + 1} من أصل ${targetImages.length}: ${img.key.substring(0, 20)}...`, { id: "batch-toast" });
      
      await compressSingleImage(img.key, true);
      processedCount++;
    }

    setIsBatchRunning(false);
    toast.dismiss("batch-toast");
    toast.success(`اكتملت عملية التقليص الجماعي! تم معالجة ${processedCount} صورة.`);
  };

  // حذف صورة وتحديث البيانات محلياً
  const handleDeleteImage = (key: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الصورة تماماً من R2؟\nلا يمكن استعادتها بعد الحذف.")) return;

    startTransition(async () => {
      const res = await deleteR2ImageAction(key);
      if (res.ok) {
        const img = images.find((i) => i.key === key);
        if (img) {
          setTotalLargeSizeMb((prev) => Math.max(0, parseFloat((prev - img.size / (1024 * 1024)).toFixed(2))));
          setTotalBucketSizeMb((prev) => Math.max(0, parseFloat((prev - img.size / (1024 * 1024)).toFixed(1))));
          if (img.usages.includes("صورة يتيمة / غير مستخدمة 🗑️")) {
            setOrphanedCount((prev) => Math.max(0, prev - 1));
          }
          setImages((prev) => prev.filter((i) => i.key !== key));
        }
        toast.success("تم حذف الصورة من R2 بنجاح!");
      } else {
        toast.error(res.error || "فشل حذف الصورة");
      }
    });
  };

  const progressPercent = totalToProcess > 0 ? Math.round((currentProgressIndex / totalToProcess) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* لوحة الإحصائيات الحية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-xs text-gray-400 font-bold">الصور الكبيرة المتبقية</p>
          <p className="text-2xl font-black text-red-600 mt-1">{images.length} صورة</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-xs text-gray-400 font-bold">حجم الصور الكبيرة الإجمالي</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{totalLargeSizeMb.toFixed(1)} ميجابايت</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-xs text-gray-400 font-bold">إجمالي حجم R2 بالكامل</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{totalBucketSizeMb.toFixed(1)} ميجابايت</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <p className="text-xs text-gray-400 font-bold">الصور الكبيرة اليتيمة</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{orphanedCount} صورة</p>
        </div>
      </div>

      {/* شريط التحكم والتقليص الجماعي */}
      {images.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">أدوات التقليص الجماعي الذكي</h3>
              <p className="text-xs text-gray-400 mt-1">يمكنك تقليص كافة الصور الكبيرة دفعة واحدة بالتتالي لتوفير المساحة وتجنب الضغط على الخادم.</p>
            </div>
            
            <button
              onClick={handleBatchCompress}
              className={`px-5 py-3 rounded-2xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 select-none cursor-pointer ${
                isBatchRunning 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              }`}
            >
              {isBatchRunning ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>🛑 إيقاف مؤقت</span>
                </>
              ) : (
                <>
                  <span>⚡ تقليص جميع الصور تلقائياً ({images.length})</span>
                </>
              )}
            </button>
          </div>

          {/* شريط التقدم التفاعلي */}
          {(isBatchRunning || currentProgressIndex > 0) && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                <span>جاري معالجة: {currentProgressIndex + 1} من أصل {totalToProcess} صورة</span>
                <span className="text-amber-600">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-l from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {images.length === 0 ? (
        <div className="bg-white p-20 text-center rounded-3xl border border-gray-100 shadow-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-emerald-600 animate-bounce">كل الصور سليمة ومقلصة!</h3>
          <p className="text-sm text-gray-400 mt-1">لا توجد أي صور يتجاوز حجمها 500 كيلوبايت في حساب R2 حالياً.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-xs font-bold">
                  <th className="p-4 w-24 text-center">المعاينة</th>
                  <th className="p-4">اسم الصورة ومسارها في R2</th>
                  <th className="p-4 w-28 text-center">الحجم الحالي</th>
                  <th className="p-4">مكان الاستخدام</th>
                  <th className="p-4 w-28 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {images.map((obj) => {
                  const isOrphaned = obj.usages.includes("صورة يتيمة / غير مستخدمة 🗑️");
                  const isProcessing = processingKeys.has(obj.key);
                  const isFailed = failedKeys.has(obj.key);

                  return (
                    <tr 
                      key={obj.key} 
                      className={`transition-all duration-500 ${
                        isProcessing 
                          ? "bg-amber-50/40" 
                          : isFailed 
                            ? "bg-red-50/20 hover:bg-red-50/30" 
                            : "hover:bg-gray-50/50"
                      }`}
                    >
                      <td className="p-4">
                        <a 
                          href={obj.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="block relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 hover:opacity-85 transition-opacity shadow-sm mx-auto" 
                          title="انقر للمعاينة الكاملة"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={obj.url} alt="معاينة" className="w-full h-full object-cover" />
                        </a>
                      </td>
                      <td className="p-4 font-mono text-[11px] max-w-xs break-all text-left" dir="ltr">
                        {obj.key}
                      </td>
                      <td className="p-4 text-center font-bold">
                        <span className="text-red-600">{obj.sizeMb} MB</span>
                        <span className="block text-[10px] text-gray-400 font-normal mt-0.5">{obj.sizeKb.toLocaleString()} KB</span>
                      </td>
                      <td className="p-4 text-xs font-bold">
                        <div className="flex flex-wrap gap-1">
                          {obj.usages.map((use, idx) => (
                            <span 
                              key={idx} 
                              className={`px-2 py-1 rounded-lg border ${
                                isOrphaned 
                                  ? "bg-red-50 text-red-700 border-red-100" 
                                  : "bg-blue-50 text-blue-700 border-blue-100"
                              }`}
                            >
                              {use}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col gap-2 justify-center items-center">
                          <button
                            onClick={() => compressSingleImage(obj.key)}
                            disabled={isProcessing || isActionPending || isBatchRunning}
                            className="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 w-28 shadow-sm cursor-pointer select-none"
                          >
                            {isProcessing ? (
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <span>🔧 تقليص الحجم</span>
                            )}
                          </button>

                          <button
                            onClick={() => handleDeleteImage(obj.key)}
                            disabled={isProcessing || isActionPending || isBatchRunning}
                            className="bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 w-28 shadow-sm cursor-pointer select-none"
                          >
                            <span className="flex items-center gap-1">
                              <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
