"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  // تحديث المؤشر عند التمرير اليدوي بسلاسة دون إعادة ريندرز مكلفة
  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current || !scrollRef.current) return;
    const container = scrollRef.current;
    const width = container.clientWidth;
    if (width <= 0) return;
    const scrollLeft = Math.abs(container.scrollLeft);
    const newIndex = Math.round(scrollLeft / (width * 0.85));
    if (newIndex >= 0 && newIndex < slides.length && newIndex !== current) {
      setCurrent(newIndex);
    }
  }, [slides.length, current]);

  // دالة التمرير البرمجي السلس
  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const child = container.children[index] as HTMLElement;
    if (child) {
      isProgrammaticScroll.current = true;
      const scrollPos = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;
      container.scrollTo({ left: scrollPos, behavior: "smooth" });
      setCurrent(index);
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 400);
    }
  }, []);

  // التحريك التلقائي كل 4.5 ثواني
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % slides.length;
        scrollToIndex(next);
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [slides.length, isPaused, scrollToIndex]);

  if (slides.length === 0) return null;

  return (
    <div
      className="w-full relative accelerate-gpu"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-3 pb-2 px-3 accelerate-gpu"
        style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            data-index={index}
            className="w-[92%] md:w-[85%] shrink-0 snap-center relative aspect-[21/9] md:aspect-[21/7] rounded-[1.5rem] overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm transition-transform duration-300 active:scale-[0.99]"
          >
            {/* الصورة */}
            <img
              src={slide.imageUrl}
              alt={slide.title || ""}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* عنوان السلايد (إن وجد) */}
            {slide.title && (
              <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-10 text-right bg-gradient-to-t from-black/70 via-black/20 to-transparent z-20">
                <h2 className="text-white text-lg md:text-3xl font-black drop-shadow-md">
                  {slide.title}
                </h2>
              </div>
            )}
            {/* الرابط */}
            {slide.linkUrl && (
              <Link href={slide.linkUrl} className="absolute inset-0 z-30" />
            )}
          </div>
        ))}
      </div>

      {/* مؤشرات دائرية */}
      {slides.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                current === idx
                  ? "w-5 bg-emerald-500 shadow-sm"
                  : "w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
              }`}
              aria-label={`الذهاب للشريحة ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
