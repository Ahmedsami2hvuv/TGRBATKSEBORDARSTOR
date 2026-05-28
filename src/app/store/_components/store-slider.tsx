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
        className="relative aspect-[16/9] md:aspect-[21/7] overflow-hidden rounded-t-[2.5rem] border-x-2 border-t-2 border-slate-100 dark:border-slate-800 bg-slate-950 touch-pan-y"
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
                <img
                  src={slide.imageUrl}
                  alt={slide.title || ""}
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[10000ms] ease-out ${
                    isActive ? "scale-115 rotate-[1.5deg] translate-x-2" : "scale-100 rotate-0 translate-x-0"
                  }`}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('?')) {
                      target.src = target.src.split('?')[0];
                    }
                  }}
                />

                {/* Premium Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-[5]" />

                {/* Content Overlay */}
                {slide.title && (
                  <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-24 text-right">
                    <div className={`transition-all duration-1000 delay-300 transform ${isActive ? "translate-y-0 opacity-100 blur-0" : "translate-y-12 opacity-0 blur-md"}`}>
                      <h2
                        className="text-white text-3xl md:text-7xl font-black tracking-tighter leading-tight drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
                        style={{
                          fontFamily: "Cairo, sans-serif",
                          textShadow: "2px 2px 20px rgba(0,0,0,0.8)",
                          letterSpacing: "-0.02em"
                        }}
                      >
                        {slide.title}
                      </h2>
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
                className="group/btn p-5 bg-white/5 backdrop-blur-xl border border-white/20 text-white rounded-[2rem] hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-xl"
             >
               <svg className="w-8 h-8 rotate-180 group-hover/btn:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
             </button>
             <button
                onClick={nextSlide}
                className="group/btn p-5 bg-white/5 backdrop-blur-xl border border-white/20 text-white rounded-[2rem] hover:bg-white/20 hover:scale-110 active:scale-90 transition-all shadow-xl"
             >
               <svg className="w-8 h-8 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
             </button>
           </div>
        )}

        {/* Premium Indicators with Progress Bar */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`h-1.5 rounded-full transition-all duration-700 relative overflow-hidden ${
                  index === current
                    ? "w-12 bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                    : "w-2 bg-white/10 hover:bg-white/40 backdrop-blur-md"
                }`}
              >
                {index === current && (
                  <div
                    className="absolute inset-y-0 left-0 bg-white shadow-[0_0_10px_#fff] animate-slider-progress"
                    style={{ animationPlayState: isPaused ? 'paused' : 'running' }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile-First Premium Controls */}
      {slides.length > 1 && (
        <div className="grid grid-cols-2 mt-0" dir="ltr">
          <button
            onClick={prevSlide}
            className="flex items-center justify-center gap-2 h-9 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-900 dark:text-white transition-all border-x-2 border-b-2 border-slate-100 dark:border-slate-800 rounded-bl-[2.5rem] active:scale-95 group"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4 group-hover:-translate-x-1 transition-transform"><path d="M15 18l-6-6 6-6" /></svg>
            <span className="font-bold text-[10px] uppercase tracking-wider">السابق</span>
          </button>

          <button
            onClick={nextSlide}
            className="flex items-center justify-center gap-2 h-9 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white transition-all border-r-2 border-b-2 border-slate-100 dark:border-slate-800 rounded-br-[2.5rem] active:scale-95 group"
          >
            <span className="font-bold text-[10px] uppercase tracking-wider">التالي</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4 group-hover:translate-x-1 transition-transform"><path d="M9 18l6-6-6-6" /></svg>
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
