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
      className="relative group w-full px-1 md:px-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Main Slider Area */}
      <div className="relative aspect-[16/9] md:aspect-[25/8] overflow-hidden rounded-[2rem] md:rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
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
                  {/* Overlay for Title */}
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

        {/* Navigation Buttons Overlay */}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-3 md:px-6 z-20 pointer-events-none" dir="ltr">
            {/* Left Button (السهم لليسار) */}
            <button
              onClick={prevSlide}
              className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-white/20 hover:bg-violet-600 backdrop-blur-md text-white border border-white/40 shadow-lg transition-all duration-300 hover:scale-110 active:scale-90 pointer-events-auto cursor-pointer"
            >
              <span className="text-2xl md:text-4xl font-black pb-1 leading-none">‹</span>
            </button>

            {/* Right Button (السهم لليمين) */}
            <button
              onClick={nextSlide}
              className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center rounded-full bg-white/20 hover:bg-violet-600 backdrop-blur-md text-white border border-white/40 shadow-lg transition-all duration-300 hover:scale-110 active:scale-90 pointer-events-auto cursor-pointer"
            >
              <span className="text-2xl md:text-4xl font-black pb-1 leading-none">›</span>
            </button>
          </div>
        )}

        {/* Navigation Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`transition-all duration-500 rounded-full ${
                  index === current ? "w-10 bg-white" : "w-2 bg-white/40"
                } h-1.5`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
