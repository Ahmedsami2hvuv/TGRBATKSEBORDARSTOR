"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export function ImageZoomModal({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  
  // لحفظ القيم أثناء السحب واللمس
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const isDraggingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  // منع السحب الافتراضي للمتصفح (Scroll) أثناء التكبير
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (scale > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchmove", preventDefault, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventDefault);
    };
  }, [scale]);

  // حساب المسافة بين نقطتين (لمعرفة المسافة بين الإصبعين)
  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // حساب نقطة المنتصف بين إصبعين
  const getMidpoint = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // سحب بإصبع واحد (Pan)
      isDraggingRef.current = scale > 1; // نسمح بالسحب فقط إذا كانت الصورة مكبرة
      touchStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      };
    } else if (e.touches.length === 2) {
      // تكبير بإصبعين (Pinch)
      isDraggingRef.current = false;
      const dist = getDistance(e.touches);
      initialDistanceRef.current = dist;
      initialScaleRef.current = scale;
      
      const mid = getMidpoint(e.touches);
      lastPositionRef.current = {
        x: mid.x - position.x,
        y: mid.y - position.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current && touchStartRef.current) {
      // تحريك الصورة بإصبع واحد
      const x = e.touches[0].clientX - touchStartRef.current.x;
      const y = e.touches[0].clientY - touchStartRef.current.y;
      setPosition({ x, y });
    } else if (e.touches.length === 2 && initialDistanceRef.current) {
      // تكبير وتصغير بإصبعين
      const dist = getDistance(e.touches);
      const factor = dist / initialDistanceRef.current;
      let newScale = initialScaleRef.current * factor;
      
      // نضع حدود للتكبير والتصغير (بين 1 و 5)
      newScale = Math.max(1, Math.min(newScale, 5));
      
      setScale(newScale);

      // نقوم بتحديث الموضع ليتركز التكبير حول منتصف الإصبعين
      const mid = getMidpoint(e.touches);
      if (lastPositionRef.current) {
        // إذا كان المقياس 1، نعيد الصورة للمركز
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        } else {
          const x = mid.x - lastPositionRef.current.x;
          const y = mid.y - lastPositionRef.current.y;
          setPosition({ x, y });
        }
      }
    }
  };

  const handleTouchEnd = () => {
    initialDistanceRef.current = null;
    touchStartRef.current = null;
    isDraggingRef.current = false;

    // إذا تم تصغير الصورة لأقل من 1، نعيد ضبطها للوضع الطبيعي
    if (scale <= 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  // دعم التكبير والتصغير بأزرار تحكم مريحة
  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 transition-all duration-300 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full flex flex-col items-center justify-center select-none touch-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* شريط الأزرار العلوي */}
        <div className="absolute top-4 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4">
          <button
            onClick={onClose}
            className="flex h-9 px-4 items-center justify-center gap-1.5 rounded-full bg-white/20 text-white hover:bg-white/35 border border-white/20 transition-all text-xs font-black shadow-xl active:scale-95 cursor-pointer"
          >
            ✕ إغلاق
          </button>
          
          <div className="flex bg-white/20 rounded-full border border-white/20 px-1 py-0.5 shadow-xl">
            <button
              onClick={zoomOut}
              className="w-8 h-8 flex items-center justify-center text-white text-lg font-black hover:bg-white/10 rounded-full cursor-pointer active:scale-90"
              title="تصغير"
            >
              −
            </button>
            <button
              onClick={resetZoom}
              className="px-2 text-white text-[10px] font-black hover:bg-white/10 rounded-lg cursor-pointer flex items-center justify-center"
              title="إعادة ضبط"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="w-8 h-8 flex items-center justify-center text-white text-lg font-black hover:bg-white/10 rounded-full cursor-pointer active:scale-90"
              title="تكبير"
            >
              +
            </button>
          </div>
        </div>

        {/* حاوية الصورة مع التحويلات (CSS transform) */}
        <div
          className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-2xl p-1 max-w-[98vw] max-h-[85vh] flex items-center justify-center transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale3d(${scale}, ${scale}, 1)`,
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="معاينة الصورة"
            className="max-w-[95vw] max-h-[80vh] object-contain rounded-xl pointer-events-none"
            draggable={false}
          />
        </div>
        
        {/* تلميح صغير للمستخدم */}
        <div className="absolute bottom-6 text-[10px] font-bold text-white/50 bg-black/40 px-3 py-1 rounded-full pointer-events-none">
          💡 يمكنك التكبير بالإصبعين أو السحب للتحريك
        </div>
      </div>
    </div>,
    document.body
  );
}
