"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

export function ScrollReveal({ 
  children, 
  className = "" 
}: { 
  children: ReactNode;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Optional: unobserve if you only want it to animate once
          if (domRef.current) observer.unobserve(domRef.current);
        }
      });
    }, {
      rootMargin: "0px 0px -50px 0px"
    });

    if (domRef.current) {
      observer.observe(domRef.current);
    }
    
    // Fallback: show anyway after 500ms to avoid freezing perception
    const fallbackTimer = setTimeout(() => {
      setIsVisible(true);
    }, 500);

    return () => {
      if (domRef.current) observer.unobserve(domRef.current);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      } ${className}`}
    >
      {children}
    </div>
  );
}
