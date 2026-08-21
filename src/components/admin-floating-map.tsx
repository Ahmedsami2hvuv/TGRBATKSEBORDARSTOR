
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, RefreshCw, Map as MapIcon, Maximize2 } from "lucide-react";
import { extractLatLngFromLocationInput } from "@/lib/order-location";

interface AdminFloatingMapProps {
  isOpen: boolean;
  onClose: () => void;
  locationUrl: string;
}

export function AdminFloatingMap({
  isOpen,
  onClose,
  locationUrl,
}: AdminFloatingMapProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [destCoords, setDestCoords] = useState<{lat: string, lng: string} | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !locationUrl) return;

    // محاولة استخراج الإحداثيات مباشرة
    const latLng = extractLatLngFromLocationInput(locationUrl);
    if (latLng) {
      setDestCoords({ lat: latLng.latitude.toString(), lng: latLng.longitude.toString() });
      setEmbedUrl(`https://maps.google.com/maps?q=${latLng.latitude},${latLng.longitude}&hl=ar&z=15&output=embed`);
      return;
    }

    // إذا كان الرابط لا يحتوي على إحداثيات مباشرة
    const resolveUrl = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/resolve-google-location?url=${encodeURIComponent(locationUrl)}`);
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
           setDestCoords({ lat: data.latitude.toString(), lng: data.longitude.toString() });
           setEmbedUrl(`https://maps.google.com/maps?q=${data.latitude},${data.longitude}&hl=ar&z=15&output=embed`);
        } else {
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

  const handleDrawRoute = () => {
    if (!destCoords) {
      alert("لم نتمكن من تحديد إحداثيات الوجهة بدقة لرسم المسار.");
      return;
    }

    setRouteLoading(true);
    if (!navigator.geolocation) {
      alert("المتصفح لا يدعم تحديد الموقع (GPS).");
      setRouteLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const myLat = position.coords.latitude;
        const myLng = position.coords.longitude;
        // تحديث الخريطة لترسم المسار من الإحداثيات الدقيقة
        setEmbedUrl(`https://maps.google.com/maps?saddr=${myLat},${myLng}&daddr=${destCoords.lat},${destCoords.lng}&hl=ar&output=embed`);
        setRouteLoading(false);
      },
      (error) => {
        console.error(error);
        alert("فشل تحديد موقعك الحالي. يرجى التأكد من إعطاء صلاحية الموقع (Location) للمتصفح.");
        setRouteLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed top-1/4 right-4 sm:right-1/4 z-[999999] w-[350px] sm:w-[450px] h-[450px] flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 border border-slate-300"
          style={{ touchAction: "none" }} // يمنع تداخل السحب مع تمرير الشاشة
        >
          {/* شريط المتصفح العلوي (للسحب) */}
          <div className="flex cursor-move items-center justify-between bg-slate-800 p-2.5 border-b border-slate-900 shrink-0">
            <div className="flex items-center gap-2">
               <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <MapIcon size={14} />
               </div>
               <span className="text-xs sm:text-sm font-bold text-white tracking-wide">متصفح الخريطة (Google Maps)</span>
            </div>
            <div className="flex items-center gap-1.5" onPointerDownCapture={(e) => e.stopPropagation()}>
              <a 
                href={locationUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="فتح في تبويب جديد (شاشة كاملة)"
              >
                <Maximize2 size={16} />
              </a>
              <button 
                onClick={onClose} 
                className="p-1.5 text-slate-300 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
                title="إغلاق المتصفح"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          {/* محتوى الخريطة (الـ Iframe) */}
          <div className="flex-1 w-full bg-slate-100 relative pointer-events-auto" onPointerDownCapture={(e) => e.stopPropagation()}>
             {isLoading ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <RefreshCw className="animate-spin" size={24} />
                  <span className="text-sm font-medium">جاري فك الرابط وتحديد الموقع...</span>
               </div>
             ) : embedUrl ? (
                <div className="flex flex-col h-full w-full bg-white">
                  <iframe
                    src={embedUrl}
                    className="flex-1 w-full border-0"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="bg-white p-2 border-t border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={handleDrawRoute}
                      disabled={routeLoading || !destCoords}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white hover:bg-blue-700 active:scale-95 shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {routeLoading ? (
                        <><RefreshCw className="animate-spin" size={16} /> جاري تحديد موقعك...</>
                      ) : (
                        <>🚀 انطلق (رسم المسار من موقعي)</>
                      )}
                    </button>
                  </div>
                </div>
             ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center gap-2">
                  <span className="text-sm">لم نتمكن من عرض الخريطة المصغرة.</span>
                  <a href={locationUrl} target="_blank" rel="noreferrer" className="text-emerald-600 text-sm font-semibold hover:underline">
                    فتح الرابط يدوياً
                  </a>
                </div>
             )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

