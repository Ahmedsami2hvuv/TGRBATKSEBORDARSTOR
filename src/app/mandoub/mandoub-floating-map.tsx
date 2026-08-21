"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, RefreshCw, Map as MapIcon } from "lucide-react";
import { extractLatLngFromLocationInput } from "@/lib/order-location";

interface MandoubFloatingMapProps {
  isOpen: boolean;
  onClose: () => void;
  locationUrl: string;
}

export function MandoubFloatingMap({
  isOpen,
  onClose,
  locationUrl,
}: MandoubFloatingMapProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !locationUrl) return;

    // محاولة استخراج الإحداثيات مباشرة
    const latLng = extractLatLngFromLocationInput(locationUrl);
    if (latLng) {
      setEmbedUrl(`https://maps.google.com/maps?q=${latLng.latitude},${latLng.longitude}&hl=ar&z=15&output=embed`);
      return;
    }

    // إذا كان الرابط لا يحتوي على إحداثيات مباشرة (مثل الروابط المختصرة)، سنطلب من السيرفر فكه
    const resolveUrl = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/resolve-google-location?url=${encodeURIComponent(locationUrl)}`);
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
           setEmbedUrl(`https://maps.google.com/maps?q=${data.latitude},${data.longitude}&hl=ar&z=15&output=embed`);
        } else {
           // في حال الفشل، نضع الرابط الأصلي
           setEmbedUrl(locationUrl);
        }
      } catch (e) {
        setEmbedUrl(locationUrl);
      } finally {
        setIsLoading(false);
      }
    };

    resolveUrl();
  }, [isOpen, locationUrl]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
          className="fixed top-1/4 right-4 z-[999999] w-[300px] sm:w-[350px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
          style={{ touchAction: "none" }} // يمنع تداخل السحب مع تمرير الشاشة
        >
          {/* شريط السحب العلوي */}
          <div className="flex cursor-move items-center justify-between bg-slate-100 p-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
               <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <MapIcon size={12} />
               </div>
               <span className="text-sm font-bold text-slate-700">خريطة مصغرة</span>
            </div>
            <div className="flex items-center gap-1.5" onPointerDownCapture={(e) => e.stopPropagation()}>
              <a 
                href={locationUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="فتح في تطبيق الخرائط"
              >
                <ExternalLink size={16} />
              </a>
              <button 
                onClick={onClose} 
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="إغلاق"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          {/* محتوى الخريطة */}
          <div className="h-[320px] w-full bg-slate-50 relative pointer-events-auto" onPointerDownCapture={(e) => e.stopPropagation()}>
             {isLoading ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <RefreshCw className="animate-spin" size={24} />
                  <span className="text-sm font-medium">جاري تحديد الموقع...</span>
               </div>
             ) : embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="h-full w-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
             ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center gap-2">
                  <span className="text-sm">لم نتمكن من عرض الخريطة المصغرة.</span>
                  <a href={locationUrl} target="_blank" rel="noreferrer" className="text-emerald-600 text-sm font-semibold hover:underline">
                    فتح الخريطة في تطبيق خارجي
                  </a>
                </div>
             )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
