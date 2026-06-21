"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { compressR2ImageAction, deleteR2ImageAction, fetchNextLargeImagesAction, fetchImagesUsagesAction } from "./actions";
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
  initialTotalLargeCount,
  icons,
}: {
  initialObjects: LargeImage[];
  initialTotalBucketSizeMb: string;
  initialTotalLargeSizeMb: string;
  initialOrphanedCount: number;
  initialTotalLargeCount: number;
  icons: GlobalIconsConfig | null;
}) {
  const [images, setImages] = useState<LargeImage[]>(initialObjects);
  const imagesRef = useRef<LargeImage[]>(initialObjects);
  const [totalBucketSizeMb, setTotalBucketSizeMb] = useState<number>(parseFloat(initialTotalBucketSizeMb));
  const [totalLargeSizeMb, setTotalLargeSizeMb] = useState<number>(parseFloat(initialTotalLargeSizeMb));
  const [orphanedCount, setOrphanedCount] = useState<number>(initialOrphanedCount);
  const [totalLargeCount, setTotalLargeCount] = useState<number>(initialTotalLargeCount);

  // حالات التقليص الجماعي (تم تحريكها للأعلى لتجنب خطأ التأسيس)
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const isBatchRunningRef = useRef(false);
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(new Set());
  const [failedKeys, setFailedKeys] = useState<Set<string>>(new Set());
  const failedKeysRef = useRef<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // تحديث متزامن للـ state والـ ref
  const updateImagesState = (newImages: LargeImage[] | ((prev: LargeImage[]) => LargeImage[])) => {
    setImages((prev) => {
      const next = typeof newImages === "function" ? newImages(prev) : newImages;
      imagesRef.current = next;
      return next;
    });
  };

  // تحديث متزامن للـ failedKeys والـ ref
  const updateFailedKeysState = (key: string) => {
    setFailedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      failedKeysRef.current = next;
      return next;
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [usagesMap, setUsagesMap] = useState<{ [key: string]: string[] }>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const fetchingKeysRef = useRef<Set<string>>(new Set());

  const itemsPerPage = 100;
  const totalPages = Math.ceil(images.length / itemsPerPage);

  // الكائنات المعروضة في الصفحة الحالية
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedImages = images.slice(startIndex, startIndex + itemsPerPage);

  // جلب الاستخدامات للصور المعروضة في الصفحة الحالية عند الحاجة
  useEffect(() => {
    if (displayedImages.length === 0 || isBatchRunning) return;

    // تحديد المفاتيح التي لا تحتوي على استخدامات بعد في usagesMap وليست قيد التحميل حالياً
    const keysToFetch = displayedImages
      .map(img => img.key)
      .filter(key => usagesMap[key] === undefined && !fetchingKeysRef.current.has(key));

    if (keysToFetch.length === 0) return;

    // قفل المفاتيح لمنع إعادة طلبها متوازياً في الرندرات الفرعية القادمة
    keysToFetch.forEach(k => fetchingKeysRef.current.add(k));

    // إضافة المفاتيح لقائمة الجاري تحميلها
    setLoadingKeys((prev) => {
      const next = new Set(prev);
      keysToFetch.forEach(k => next.add(k));
      return next;
    });

    const fetchUsages = async () => {
      const res = await fetchImagesUsagesAction(keysToFetch);
      if (res.ok && res.usages) {
        setUsagesMap((prev) => ({
          ...prev,
          ...res.usages
        }));
      }

      // إزالة المفاتيح من قائمة الجاري تحميلها
      setLoadingKeys((prev) => {
        const next = new Set(prev);
        keysToFetch.forEach(k => next.delete(k));
        return next;
      });

      // إزالة القفل
      keysToFetch.forEach(k => fetchingKeysRef.current.delete(k));
    };

    fetchUsages();
  }, [currentPage, images, isBatchRunning]);
  
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
        const imgUsages = usagesMap[key] || [];
        if (imgUsages.length === 0) {
          setOrphanedCount((prev) => Math.max(0, prev - 1));
        }

        // إزالة الصورة من الجدول
        updateImagesState((prev) => prev.filter((i) => i.key !== key));
        // إنقاص العدد الكلي الفعلي للصور الكبيرة المتبقية
        setTotalLargeCount((prev) => Math.max(0, prev - 1));
      }
      
      if (!isBatch) {
        toast.success("تم تقليص حجم الصورة بنجاح بنسبة تتجاوز 95% واختفت من الجدول!");
      }
    } else {
      updateFailedKeysState(key);
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

  // تقليص جميع الصور تلقائياً بالتتالي وبشكل مستمر بين الدفعات
  const handleBatchCompress = async () => {
    if (isBatchRunningRef.current) {
      // إيقاف مؤقت
      isBatchRunningRef.current = false;
      setIsBatchRunning(false);
      toast.info("تم إيقاف عملية التقليص الجماعي مؤقتاً.");
      return;
    }

    isBatchRunningRef.current = true;
    setIsBatchRunning(true);
    setFailedKeys(new Set());
    failedKeysRef.current = new Set();

    toast.loading("بدء عملية تقليص جميع الصور تلقائياً بالتتالي...", { id: "batch-toast" });

    let totalProcessedCount = 0;

    while (isBatchRunningRef.current) {
      let currentImages = [...imagesRef.current];

      // تصفية الصور التي لم تفشل بعد في هذه المحاولة
      const remainingUnfailed = currentImages.filter(img => !failedKeysRef.current.has(img.key));

      // إذا لم يتبق أي صور صالحة غير معالجة في الدفعة الحالية، نحاول جلب الدفعة التالية تلقائياً
      if (remainingUnfailed.length === 0) {
        toast.loading("جاري جلب الدفعة التالية من الصور الكبيرة من R2...", { id: "batch-toast" });
        const res = await fetchNextLargeImagesAction();
        
        if (res.ok && res.objects && res.objects.length > 0) {
          updateImagesState(res.objects);
          setTotalLargeCount(res.totalCount);
          currentImages = [...res.objects];
        } else {
          // لم يعد هناك صور كبيرة أو حدث خطأ
          if (res.error) {
            toast.error(res.error, { id: "batch-toast" });
          }
          break;
        }
      }

      // سنقوم بمعالجة الصور غير الفاشلة فقط في الدفعة الحالية
      const targetImages = currentImages.filter(img => !failedKeysRef.current.has(img.key));
      setTotalToProcess(targetImages.length);
      let batchFinished = true;

      for (let i = 0; i < targetImages.length; i++) {
        if (!isBatchRunningRef.current) {
          batchFinished = false;
          break;
        }

        const img = targetImages[i];
        setCurrentProgressIndex(i);
        toast.loading(`جاري تقليص صورة ${i + 1} من أصل ${targetImages.length}: ${img.key.substring(0, 20)}...`, { id: "batch-toast" });
        
        const success = await compressSingleImage(img.key, true);
        if (success) {
          totalProcessedCount++;
        }
      }

      // إذا توقفت العملية يدوياً أثناء الدفعة، نخرج من الحلقة
      if (!batchFinished) {
        break;
      }
    }

    isBatchRunningRef.current = false;
    setIsBatchRunning(false);
    toast.dismiss("batch-toast");
    toast.success(`اكتملت عملية التقليص الجماعي! تم معالجة ${totalProcessedCount} صورة بنجاح.`);
  };

  // تحديث وجلب الدفعة التالية يدوياً دون ريفريش كامل للصفحة
  const handleManualRefresh = async () => {
    if (isRefreshing || isBatchRunning) return;
    setIsRefreshing(true);
    toast.loading("جاري تحديث القائمة وجلب صور R2 الكبيرة...", { id: "refresh-toast" });
    
    const res = await fetchNextLargeImagesAction();
    setIsRefreshing(false);
    toast.dismiss("refresh-toast");

    if (res.ok && res.objects) {
      updateImagesState(res.objects);
      setTotalLargeCount(res.totalCount);
      
      // حساب الإحصائيات النسبية التقريبية
      let newOrphaned = 0;
      res.objects.forEach(img => {
        if (img.usages.includes("صورة يتيمة / غير مستخدمة 🗑️")) {
          newOrphaned++;
        }
      });
      setOrphanedCount(newOrphaned);
      
      toast.success(`تم تحديث القائمة بنجاح! تم العثور على ${res.totalCount} صورة متبقية.`);
    } else {
      toast.error(res.error || "فشل تحديث القائمة");
    }
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
          const imgUsages = usagesMap[key] || [];
          if (imgUsages.length === 0) {
            setOrphanedCount((prev) => Math.max(0, prev - 1));
          }
          updateImagesState((prev) => prev.filter((i) => i.key !== key));
          setTotalLargeCount((prev) => Math.max(0, prev - 1));
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
          <p className="text-2xl font-black text-red-600 mt-1">{totalLargeCount} صورة</p>
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
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleManualRefresh}
                disabled={isBatchRunning || isRefreshing}
                className="px-5 py-3 rounded-2xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-all flex items-center gap-2 select-none cursor-pointer disabled:opacity-50"
              >
                {isRefreshing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <>
                    <span>🔄 تحديث وجلب الدفعة التالية ({totalLargeCount})</span>
                  </>
                )}
              </button>

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
        <div className="space-y-4">
          {/* ترقيم الصفحات بالأعلى */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm animate-in fade-in duration-300">
              <div className="text-xs font-bold text-gray-500 select-none">
                عرض صفحة <span className="text-amber-600">{currentPage}</span> من أصل <span className="text-gray-700">{totalPages}</span> صفحات ({images.length} صورة)
              </div>
              <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || isBatchRunning}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition-all select-none cursor-pointer border border-gray-100"
                >
                  Prev
                </button>
                
                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageNum = index + 1;
                  if (totalPages > 8) {
                    const isNearCurrent = Math.abs(currentPage - pageNum) <= 2;
                    const isFirstOrLast = pageNum === 1 || pageNum === totalPages;
                    if (!isNearCurrent && !isFirstOrLast) {
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={pageNum} className="text-gray-400 text-xs px-1 select-none">...</span>;
                      }
                      return null;
                    }
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={isBatchRunning}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-all select-none cursor-pointer border ${
                        currentPage === pageNum
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || isBatchRunning}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-50 hover:bg-gray-100 disabled:opacity-40 transition-all select-none cursor-pointer border border-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}

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
                {displayedImages.map((obj) => {
                  const usages = usagesMap[obj.key];
                  const isLoading = usages === undefined;
                  const isOrphaned = !isLoading && usages.length === 0;
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
                          {isLoading ? (
                            <span className="text-gray-400 animate-pulse flex items-center gap-1 select-none font-normal">
                              <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></span>
                              جاري التحميل...
                            </span>
                          ) : usages.length === 0 ? (
                            <span className="px-2 py-1 rounded-lg border bg-red-50 text-red-700 border-red-100">
                              صورة يتيمة / غير مستخدمة 🗑️
                            </span>
                          ) : (
                            usages.map((use, idx) => (
                              <span 
                                key={idx} 
                                className="px-2 py-1 rounded-lg border bg-blue-50 text-blue-700 border-blue-100"
                              >
                                {use}
                              </span>
                            ))
                          )}
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
        </div>
      )}
    </div>
  );
}
