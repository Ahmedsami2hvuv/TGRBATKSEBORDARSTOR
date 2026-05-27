"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

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

  const SLIDE_DURATION = 6000; // 6 seconds for a professional feel
  const minSwipeDistance = 50;

  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) nextSlide();
    else if (isRightSwipe) prevSlide();
  };

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [slides.length, isPaused, nextSlide]);

  if (slides.length === 0) return null;

  return (
    <div
      className="w-full group select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="relative aspect-[16/9] md:aspect-[21/7] overflow-hidden rounded-[2rem] md:rounded-[3.5rem] shadow-2xl border-4 border-white dark:border-slate-800 bg-slate-900 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((slide, index) => {
          const isActive = index === current;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <div className="relative w-full h-full overflow-hidden">
                {/* Image with Ken Burns Effect */}
                <Image
                  src={slide.imageUrl}
                  alt={slide.title || ""}
                  fill
                  priority={index === 0}
                  className={`object-cover transition-transform duration-[6000ms] ease-linear ${
                    isActive ? "scale-110" : "scale-100"
                  }`}
                  sizes="(max-width: 768px) 100vw, 80vw"
                />

                {/* Professional Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40 opacity-30" />

                {/* Content Overlay */}
                {slide.title && (
                  <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16 text-right">
                    <h2
                      className={`text-white text-2xl md:text-6xl font-black drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-1000 delay-300 transform ${
                        isActive ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                      }`}
                      style={{ fontFamily: "Cairo, sans-serif" }}
                    >
                      {slide.title}
                    </h2>
                    <div className={`mt-4 h-1 w-24 bg-violet-500 rounded-full transition-all duration-1000 delay-500 ml-auto ${
                      isActive ? "w-32 opacity-100" : "w-0 opacity-0"
                    }`} />
                  </div>
                )}

                {slide.linkUrl && (
                  <Link href={slide.linkUrl} className="absolute inset-0 z-20 cursor-pointer">
                    <span className="sr-only">مشاهدة المزيد</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {/* Floating Navigation Controls (Only visible on hover/group) */}
        {slides.length > 1 && (
           <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between z-30 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex">
             <button onClick={prevSlide} className="p-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl hover:bg-white/20 transition-all">
               <svg className="w-6 h-6 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
             </button>
             <button onClick={nextSlide} className="p-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl hover:bg-white/20 transition-all">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
             </button>
           </div>
        )}

        {/* Elegant Minimal Indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-30">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  index === current ? "w-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" : "w-2.5 bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Dynamic Progress Bar */}
        {slides.length > 1 && (
          <div className="absolute bottom-0 left-0 h-1.5 w-full z-40 bg-white/10">
            <div
              key={current + (isPaused ? "-paused" : "-active")}
              className={`h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_15px_rgba(139,92,246,0.5)] ${
                isPaused ? "w-full opacity-30" : "animate-slider-progress"
              }`}
            />
          </div>
        )}
      </div>

      {/* Touch-Friendly Action Buttons */}
      {slides.length > 1 && (
        <div className="grid grid-cols-2 gap-4 mt-5" dir="ltr">
          <button
            onClick={prevSlide}
            className="flex items-center justify-center gap-2 h-14 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-900 dark:text-white rounded-2xl transition-all shadow-sm border-2 border-slate-100 dark:border-slate-700 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-5 h-5"><path d="M15 18l-6-6 6-6" /></svg>
            <span className="font-bold tracking-tight">السابق</span>
          </button>

          <button
            onClick={nextSlide}
            className="flex items-center justify-center gap-2 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl transition-all shadow-lg shadow-violet-200 dark:shadow-none active:scale-95"
          >
            <span className="font-bold tracking-tight">التالي</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-5 h-5"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes slider-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-slider-progress {
          animation: slider-progress ${SLIDE_DURATION}ms linear forwards;
        }
      `}</style>
    </div>
  );
}
