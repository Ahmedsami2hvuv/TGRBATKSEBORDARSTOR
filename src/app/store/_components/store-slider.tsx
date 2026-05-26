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

  // Minimal swipe distance in pixels
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

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
  };

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused, nextSlide]);

  if (slides.length === 0) return null;

  return (
    <div
      className="w-full group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Container with rounded corners */}
      <div
        className="relative aspect-[16/9] md:aspect-[21/7] overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-xl border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-900 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((slide, index) => {
          const isActive = index === current;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                isActive ? "opacity-100 translate-x-0 scale-100" :
                index < current ? "opacity-0 -translate-x-full scale-105 pointer-events-none" : "opacity-0 translate-x-full scale-105 pointer-events-none"
              }`}
            >
              <div className="relative w-full h-full">
                {slide.linkUrl ? (
                  <Link href={slide.linkUrl} className="block w-full h-full relative">
                    <Image
                      src={slide.imageUrl}
                      alt={slide.title || ""}
                      fill
                      priority={index === 0}
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 80vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    {slide.title && (
                      <div className="absolute bottom-6 right-6 left-6 text-right">
                        <h2 className="text-white text-xl md:text-4xl font-black drop-shadow-2xl translate-y-0 transition-transform duration-500 delay-100">
                          {slide.title}
                        </h2>
                      </div>
                    )}
                  </Link>
                ) : (
                  <>
                    <Image
                      src={slide.imageUrl}
                      alt={slide.title || ""}
                      fill
                      priority={index === 0}
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 80vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60" />
                    {slide.title && (
                      <div className="absolute bottom-6 right-6 left-6 text-right">
                        <h2 className="text-white text-xl md:text-4xl font-black drop-shadow-2xl">
                          {slide.title}
                        </h2>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Small indicators bottom center */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`h-1.5 transition-all duration-300 rounded-full cursor-pointer ${
                  index === current ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Auto-play progress bar */}
        {slides.length > 1 && !isPaused && (
          <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full z-20 overflow-hidden">
            <div
              key={current} // Reset animation on slide change
              className="h-full bg-violet-400 animate-slider-progress"
            />
          </div>
        )}
      </div>

      {/* Navigation Buttons Below Image - Slim Rectangular Style */}
      {slides.length > 1 && (
        <div className="grid grid-cols-2 gap-3 mt-3 px-1" dir="ltr">
          <button
            onClick={prevSlide}
            className="flex items-center justify-center h-10 md:h-12 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl transition-all shadow-lg shadow-violet-200 dark:shadow-none border-b-4 border-violet-800 cursor-pointer"
            aria-label="Previous slide"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span className="font-bold text-sm md:text-base mr-1">السابق</span>
          </button>

          <button
            onClick={nextSlide}
            className="flex items-center justify-center h-10 md:h-12 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl transition-all shadow-lg shadow-violet-200 dark:shadow-none border-b-4 border-violet-800 cursor-pointer"
            aria-label="Next slide"
          >
            <span className="font-bold text-sm md:text-base ml-1">التالي</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      )}

      {/* Adding the animation keyframes directly via style tag or assuming it will be in global css */}
      <style jsx global>{`
        @keyframes slider-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-slider-progress {
          animation: slider-progress 5000ms linear forwards;
        }
      `}</style>
    </div>
  );
}
