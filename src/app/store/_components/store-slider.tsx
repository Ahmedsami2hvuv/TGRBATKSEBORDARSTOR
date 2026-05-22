"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  if (slides.length === 0) return null;

  const nextSlide = () => setCurrent((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Container with rounded corners */}
      <div className="relative aspect-[16/9] md:aspect-[21/7] overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-xl border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === current ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
            }`}
          >
            {slide.linkUrl ? (
              <Link href={slide.linkUrl} className="block w-full h-full relative">
                <img
                  src={slide.imageUrl}
                  alt={slide.title || ""}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {slide.title && (
                  <div className="absolute bottom-6 right-6 left-6 text-right">
                    <h2 className="text-white text-xl md:text-4xl font-black drop-shadow-2xl">
                      {slide.title}
                    </h2>
                  </div>
                )}
              </Link>
            ) : (
              <div className="w-full h-full relative">
                <img
                  src={slide.imageUrl}
                  alt={slide.title || ""}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {slide.title && (
                  <div className="absolute bottom-6 right-6 left-6 text-right">
                    <h2 className="text-white text-xl md:text-4xl font-black drop-shadow-2xl">
                      {slide.title}
                    </h2>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Small indicators bottom center */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 transition-all duration-300 rounded-full ${
                  index === current ? "w-8 bg-white" : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Navigation Buttons Below Image - Slim Rectangular Style */}
      {slides.length > 1 && (
        <div className="grid grid-cols-2 gap-3 mt-3 px-1" dir="ltr">
          <button
            onClick={prevSlide}
            className="flex items-center justify-center h-10 md:h-12 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl transition-all shadow-lg shadow-violet-200 dark:shadow-none border-b-4 border-violet-800 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span className="font-bold text-sm md:text-base mr-1">السابق</span>
          </button>

          <button
            onClick={nextSlide}
            className="flex items-center justify-center h-10 md:h-12 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl transition-all shadow-lg shadow-violet-200 dark:shadow-none border-b-4 border-violet-800 cursor-pointer"
          >
            <span className="font-bold text-sm md:text-base ml-1">التالي</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 md:w-8 md:h-8">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
