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
      className="relative group w-full px-2 md:px-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Main Slider Area */}
      <div className="relative aspect-[16/9] md:aspect-[25/8] overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-lg shadow-slate-200/50 dark:shadow-none border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
              index === current ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-105 translate-x-4 pointer-events-none"
            }`}
          >
            <div className="relative w-full h-full">
              {slide.linkUrl ? (
                <Link href={slide.linkUrl} className="block w-full h-full relative">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title || ""}
                    className="w-full h-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {slide.title && (
                    <div className="absolute bottom-10 right-6 left-6 text-right animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                      <h2 className="text-white text-xl md:text-3xl font-black drop-shadow-lg line-clamp-2">
                        {slide.title}
                      </h2>
                    </div>
                  )}
                </Link>
              ) : (
                <>
                  <img
                    src={slide.imageUrl}
                    alt={slide.title || ""}
                    className="w-full h-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {slide.title && (
                    <div className="absolute bottom-10 right-6 left-6 text-right animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                      <h2 className="text-white text-xl md:text-3xl font-black drop-shadow-lg line-clamp-2">
                        {slide.title}
                      </h2>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {/* Simple Progress indicators inside slider */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`transition-all duration-500 rounded-full h-1 ${
                  index === current ? "w-6 bg-white" : "w-1 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Slim Navigation Buttons Below Slider */}
      {slides.length > 1 && (
        <div className="grid grid-cols-2 gap-3 mt-4" dir="ltr">
          {/* Left Button (السابق) */}
          <button
            onClick={prevSlide}
            className="h-10 md:h-12 rounded-xl bg-violet-600 text-white shadow-md hover:bg-violet-700 transition-all active:scale-95 cursor-pointer flex items-center justify-center border-b-2 border-violet-800"
            title="السابق"
          >
            <span className="text-4xl md:text-5xl font-black pb-1">‹</span>
          </button>

          {/* Right Button (التالي) */}
          <button
            onClick={nextSlide}
            className="h-10 md:h-12 rounded-xl bg-violet-600 text-white shadow-md hover:bg-violet-700 transition-all active:scale-95 cursor-pointer flex items-center justify-center border-b-2 border-violet-800"
            title="التالي"
          >
            <span className="text-4xl md:text-5xl font-black pb-1">›</span>
          </button>
        </div>
      )}
    </div>
  );
}
