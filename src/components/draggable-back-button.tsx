"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function DraggableBackButton() {
  const router = useRouter();
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLButtonElement>(null);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("back_btn_pos");
    if (saved) {
      try { setPosition(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const handleStart = (e: any) => {
    setIsDragging(true);
    const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;

    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      offset.current = {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }
  };

  const handleMove = (e: any) => {
    if (!isDragging) return;
    const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    const newX = window.innerWidth - clientX - (dragRef.current?.offsetWidth || 0) + offset.current.x;
    const newY = window.innerHeight - clientY - (dragRef.current?.offsetHeight || 0) + offset.current.y;

    const nextPos = {
      x: Math.max(10, Math.min(window.innerWidth - 70, newX)),
      y: Math.max(10, Math.min(window.innerHeight - 70, newY))
    };

    setPosition(nextPos);
  };

  const handleEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem("back_btn_pos", JSON.stringify(position));
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove);
      window.addEventListener("touchend", handleEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  return (
    <button
      ref={dragRef}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      onClick={() => !isDragging && router.back()}
      style={{
        bottom: `${position.y}px`,
        right: `${position.x}px`,
        touchAction: "none"
      }}
      className={`fixed z-[9999] w-14 h-14 bg-slate-900/90 backdrop-blur text-white rounded-full shadow-2xl flex items-center justify-center text-2xl transition-transform active:scale-90 ${isDragging ? 'scale-110 opacity-50 cursor-grabbing' : 'cursor-pointer'}`}
    >
      🔙
    </button>
  );
}
