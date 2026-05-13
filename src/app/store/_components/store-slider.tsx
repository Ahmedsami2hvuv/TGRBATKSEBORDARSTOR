"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Slide {
  id: string;
  imageUrl: string;
  linkUrl: string;
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

  return (
    <div className="flex items-center gap-2 md:gap-6 group">
      {/* Previous Button - Right Side (RTL) */}
      {slides.length > 1 && (
        <button
          onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
          className="flex flex-none w-7 md:w-14 h-24 md:h-56 rounded-2xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none items-center justify-center text-slate-400 hover:text-violet-600 hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-300 active:scale-90 z-10 cursor-pointer"
          title="السابق"
        >
          <span className="text-2xl md:text-4xl font-light leading-none">›</span>
        </button>
      )}

      {/* Main Slider Area */}
      <div
        className="relative flex-1 aspect-[21/9] md:aspect-[25/9] overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-slate-200/50 dark:shadow-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === current ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-110 -rotate-1 pointer-events-none"
            }`}
          >
            {slide.linkUrl ? (
              <Link href={slide.linkUrl} className="block w-full h-full relative">
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </Link>
            ) : (
              <div className="w-full h-full relative">
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
            )}
          </div>
        ))}

        {/* Navigation Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === current ? "w-8 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Next Button - Left Side (RTL) */}
      {slides.length > 1 && (
        <button
          onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
          className="flex flex-none w-7 md:w-14 h-24 md:h-56 rounded-2xl md:rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none items-center justify-center text-slate-400 hover:text-violet-600 hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-300 active:scale-90 z-10 cursor-pointer"
          title="التالي"
        >
          <span className="text-2xl md:text-4xl font-light leading-none">‹</span>
        </button>
      )}
    </div>
  );
}
