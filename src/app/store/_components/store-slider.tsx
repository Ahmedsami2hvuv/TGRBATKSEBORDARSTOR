"use client";

import { useState, useEffect, useCallback } from "react";
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

  const SLIDE_DURATION = 6000;
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
        className="relative aspect-[16/9] md:aspect-[21/7] overflow-hidden rounded-[2.5rem] md:rounded-[4rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border-[6px] border-white dark:border-slate-800 bg-slate-950 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((slide, index) => {
          const isActive = index === current;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-all duration-[1200ms] cubic-bezier(0.4, 0, 0.2, 1) ${
                isActive ? "opacity-100 scale-100 z-10" : "opacity-0 scale-105 z-0 pointer-events-none"
              }`}
            >
              <div className="relative w-full h-full overflow-hidden">
                {/* Advanced Ken Burns Effect */}
                <Image
                  src={slide.imageUrl}
                  alt={slide.title || ""}
                  fill
                  priority={index === 0}
                  className={`object-cover transition-transform duration-[8000ms] ease-out ${
                    isActive ? "scale-110 rotate-1" : "scale-100 rotate-0"
                  }`}
                  sizes="(max-width: 768px) 100vw, 90vw"
                />

                {/* Layered Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-violet-950/20 via-transparent to-transparent opacity-40" />

                {/* Content Overlay */}
                {slide.title && (
                  <div className="absolute inset-0 flex flex-col justify-end p-10 md:p-20 text-right">
                    <div className={`transition-all duration-1000 delay-300 transform ${isActive ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}>
                      <h2
                        className="text-white text-3xl md:text-7xl font-black tracking-tight leading-tight drop-shadow-[0_8px_30px_rgba(0,0,0,0.8)]"
                        style={{ fontFamily: "Cairo, sans-serif" }}
                      >
                        {slide.title}
                      </h2>
                      <div className={`mt-6 h-2 bg-gradient-to-l from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000 delay-700 ml-auto shadow-[0_0_20px_rgba(168,85,247,0.6)] ${
                        isActive ? "w-48 opacity-100" : "w-0 opacity-0"
                      }`} />
                    </div>
                  </div>
                )}

                {slide.linkUrl && (
                  <Link href={slide.linkUrl} className="absolute inset-0 z-20 cursor-pointer">
                    <span className="sr-only">التفاصيل</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {/* Floating Glass Navigation Controls */}
        {slides.length > 1 && (
           <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex justify-between z-30 opacity-0 group-hover:opacity-100 transition-all duration-500 hidden md:flex">
             <button
                onClick={prevSlide}
                className="group/btn p-5 bg-white/5 backdrop-blur-xl border border-white/20 text-white rounded-[2rem] hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-2xl"
             >
               <svg className="w-8 h-8 rotate-180 group-hover/btn:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
             </button>
             <button
                onClick={nextSlide}
                className="group/btn p-5 bg-white/5 backdrop-blur-xl border border-white/20 text-white rounded-[2rem] hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-2xl"
             >
               <svg className="w-8 h-8 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
             </button>
           </div>
        )}

        {/* Premium Indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 z-30">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`h-2.5 rounded-full transition-all duration-700 ${
                  index === current
                    ? "w-16 bg-white shadow-[0_0_25px_rgba(255,255,255,1)]"
                    : "w-3 bg-white/20 hover:bg-white/40 backdrop-blur-sm"
                }`}
              />
            ))}
          </div>
        )}

        {/* Smooth Progress Bar with Glow */}
        {slides.length > 1 && (
          <div className="absolute bottom-0 left-0 h-2 w-full z-40 bg-black/20 backdrop-blur-sm">
            <div
              key={current + (isPaused ? "-paused" : "-active")}
              className={`h-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 shadow-[0_0_20px_rgba(168,85,247,0.8)] ${
                isPaused ? "w-full opacity-20" : "animate-slider-progress"
              }`}
            />
          </div>
        )}
      </div>

      {/* Mobile-First Premium Controls */}
      {slides.length > 1 && (
        <div className="grid grid-cols-2 gap-4 mt-6" dir="ltr">
          <button
            onClick={prevSlide}
            className="flex items-center justify-center gap-3 h-16 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-900 dark:text-white rounded-[1.5rem] transition-all shadow-lg border border-slate-200 dark:border-slate-800 active:scale-95 group"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-6 h-6 group-hover:-translate-x-1 transition-transform"><path d="M15 18l-6-6 6-6" /></svg>
            <span className="font-black text-lg uppercase tracking-wider">السابق</span>
          </button>

          <button
            onClick={nextSlide}
            className="flex items-center justify-center gap-3 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-[1.5rem] transition-all shadow-xl shadow-violet-200 dark:shadow-none active:scale-95 group"
          >
            <span className="font-black text-lg uppercase tracking-wider">التالي</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-6 h-6 group-hover:translate-x-1 transition-transform"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes slider-progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-slider-progress {
          animation: slider-progress ${SLIDE_DURATION}ms linear forwards;
        }
      `}</style>
    </div>
  );
}
