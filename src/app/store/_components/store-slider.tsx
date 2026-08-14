"use client";

import { useState, useEffect, useRef } from "react";
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

  // تحديث النقطة النشطة عند التمرير باستخدام IntersectionObserver (يدعم الـ RTL بشكل مثالي)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            setCurrent(index);
          }
        });
      },
      {
        root: container,
        threshold: 0.6, // العنصر الذي يظهر بنسبة 60% يصبح هو النشط
      }
    );

    Array.from(container.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [slides]);

  // دالة التمرير للعنصر المطلوب
  const scrollToIndex = (index: number) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const child = container.children[index] as HTMLElement;
    if (child) {
      // حساب الموقع بالنسبة للحاوية لتجنب scrollIntoView الذي يحرك الشاشة بأكملها
      const scrollPos = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;
      container.scrollTo({ left: scrollPos, behavior: "smooth" });
    }
  };

  // التحريك التلقائي كل 4 ثواني
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % slides.length;
        scrollToIndex(next);
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  if (slides.length === 0) return null;

  return (
    <div
      className="w-full relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-2 pb-2 px-3"
        style={{ scrollBehavior: "smooth" }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            data-index={index}
            className="w-[94%] md:w-[85%] shrink-0 snap-center relative aspect-[21/9] md:aspect-[21/7] rounded-[1.5rem] overflow-hidden bg-slate-100 shadow-sm"
          >
            {/* الصورة */}
            <img
              src={slide.imageUrl}
              alt={slide.title || ""}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* عنوان السلايد (إن وجد) مع تدرج لوني لضمان وضوح النص */}
            {slide.title && (
              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 text-right bg-gradient-to-t from-black/60 via-transparent to-transparent z-20">
                <h2 className="text-white text-xl md:text-4xl font-black drop-shadow-md">
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
        <div className="flex justify-center items-center gap-1.5 mt-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                current === idx
                  ? "w-4 bg-green-500"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`الذهاب للشريحة ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
