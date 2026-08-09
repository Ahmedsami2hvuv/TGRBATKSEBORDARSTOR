"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Slide {
  id: string;
  imageUrl: string;
  linkUrl: string;
  title?: string | null;
}

export function StoreSlider({ slides }: { slides: Slide[] }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(nextSlide, 6000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused, nextSlide]);

  if (slides.length === 0) return null;

  return (
    <div
      className="w-full group select-none relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="relative aspect-[16/9] md:aspect-[21/7] overflow-hidden rounded-[2.5rem] bg-slate-950 touch-pan-y"
        onTouchStart={(e) => setTouchStart(e.targetTouches[0].clientX)}
        onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
        onTouchEnd={() => {
          if (!touchStart || !touchEnd) return;
          const dist = touchStart - touchEnd;
          if (dist > 50) nextSlide();
          if (dist < -50) prevSlide();
          setTouchStart(null);
          setTouchEnd(null);
        }}
      >
        {slides.map((slide, index) => {
          const isActive = index === current;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-all duration-[1000ms] ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <div className="relative w-full h-full">
                {/* صورة صافية تماماً بدون أي تدرجات أو ظلال */}
                <img
                  src={slide.imageUrl}
                  alt={slide.title || ""}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {slide.title && (
                  <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-20 text-right z-20">
                    <h2 className={`text-white text-2xl md:text-5xl font-black transition-all duration-700 drop-shadow-md ${isActive ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
                      {slide.title}
                    </h2>
                  </div>
                )}

                {slide.linkUrl && (
                  <Link href={slide.linkUrl} className="absolute inset-0 z-30" />
                )}
              </div>
            </div>
          );
        })}

        {/* تم إزالة نقاط التنقل (الشريط الشفاف) نهائياً */}
      </div>

      {/* أزرار التنقل السفلية - نظيفة وبدون حدود */}
      {slides.length > 1 && (
        <div className="grid grid-cols-2 mt-0 overflow-hidden rounded-b-[2.5rem] relative z-40" dir="ltr">
          <button
            onClick={prevSlide}
            className="h-12 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-black text-[11px] uppercase tracking-widest active:bg-slate-200 transition-colors"
          >
            السابق
          </button>
          <button
            onClick={nextSlide}
            className="h-12 bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest active:bg-indigo-700 transition-colors"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
