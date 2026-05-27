"use client";

import React, { useState, useEffect, useRef } from "react";

interface CustomLink {
  id: string;
  name: string;
  url: string;
}

interface CustomCategory {
  id: string;
  name: string;
  links: CustomLink[];
}

export function FloatingAdminMenu() {
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const [categories, setCategories] = useState<CustomCategory[]>([]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("kse_admin_floating_links");
    if (saved) {
      try {
        setCategories(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved links", e);
      }
    } else {
      // Default: Delegates category
      setCategories([{ id: "delegates", name: "المندوبين", links: [] }]);
    }

    // Load position
    const savedPos = localStorage.getItem("kse_admin_floating_pos");
    if (savedPos) {
      try {
        setPosition(JSON.parse(savedPos));
      } catch {}
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("kse_admin_floating_links", JSON.stringify(categories));
  }, [categories]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem("kse_admin_floating_pos", JSON.stringify(position));
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  const addCategory = () => {
    const name = window.prompt("اسم القسم الجديد:");
    if (name) {
      setCategories([...categories, { id: Date.now().toString(), name, links: [] }]);
    }
  };

  const removeCategory = (categoryId: string) => {
    if (window.confirm("هل أنت متأكد من حذف هذا القسم بالكامل؟")) {
      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    }
  };

  const addLink = (categoryId: string) => {
    const name = window.prompt("اسم الرابط:");
    if (!name) return;
    const url = window.prompt("رابط الصفحة:");
    if (url) {
      setCategories(prev => prev.map(cat => {
        if (cat.id === categoryId) {
          return { ...cat, links: [...cat.links, { id: Date.now().toString(), name, url }] };
        }
        return cat;
      }));
    }
  };

  const removeLink = (categoryId: string, linkId: string) => {
    if (window.confirm("هل أنت متأكد من حذف هذا الرابط؟")) {
      setCategories(prev => prev.map(cat => {
        if (cat.id === categoryId) {
          return { ...cat, links: cat.links.filter(l => l.id !== linkId) };
        }
        return cat;
      }));
    }
  };

  // Radial positioning logic
  const getRadialStyle = (index: number, total: number, radius: number, angleOffset: number = 0) => {
    if (total === 0) return {};

    // Determine side (right or left) to expand to
    const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);

    // Half circle (180 degrees)
    const angleRange = 180;
    const baseAngle = isLeft ? -90 : 90;
    const step = total > 1 ? angleRange / (total - 1) : 0;
    const angle = baseAngle + (index * step) + angleOffset;

    const radian = (angle * Math.PI) / 180;

    const tx = Math.cos(radian) * radius;
    const ty = Math.sin(radian) * radius;

    return {
      transform: `translate(${tx}px, ${ty}px)`,
      transitionDelay: `${index * 50}ms`,
      opacity: 1,
      scale: 1,
    };
  };

  return (
    <div
      className="fixed z-[999] touch-none select-none"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredCategory(null);
      }}
    >
      {/* Decorative Sun Rays (visual lines) */}
      <div className={`absolute left-7 top-7 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        {Array.from({ length: 12 }).map((_, i) => (
           <div
             key={i}
             className="absolute w-[120px] h-[1px] bg-gradient-to-r from-[#00f3ff]/40 to-transparent origin-left"
             style={{ transform: `rotate(${i * 30}deg)` }}
           />
        ))}
      </div>

      {/* Main Button */}
      <button
        onMouseDown={handleMouseDown}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#00f3ff] to-[#e028ff] text-black shadow-[0_0_20px_rgba(0,243,255,0.6)] transition-all duration-300 active:scale-95 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${isHovered ? "scale-110 shadow-[0_0_30px_rgba(224,40,255,0.8)]" : ""}`}
      >
        <span className="text-2xl font-black">⚙️</span>
        <div className={`absolute inset-0 rounded-full bg-[#00f3ff]/20 animate-pulse ${isHovered ? 'hidden' : ''}`} />
      </button>

      {/* Radial Menu - Categories */}
      <div className={`absolute left-7 top-7 -translate-x-1/2 -translate-y-1/2 pointer-events-none`}>
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            style={isHovered ? getRadialStyle(idx, categories.length + 1, 130) : { opacity: 0, scale: 0 }}
            className={`absolute flex h-12 w-32 items-center justify-center rounded-xl border border-[#00f3ff]/30 bg-slate-900/95 text-[11px] font-bold text-[#00f3ff] backdrop-blur-md transition-all duration-300 pointer-events-auto hover:bg-[#00f3ff] hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.3)] group/cat`}
            onMouseEnter={() => setHoveredCategory(cat.id)}
          >
            <span className="truncate px-2">{cat.name}</span>

            <button
              onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}
              className="absolute -top-2 -right-2 hidden group-hover/cat:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow-lg"
            >
              ×
            </button>

            {/* Sub-menu for Links (Sun rays from category) */}
            <div className={`absolute inset-0 pointer-events-none`}>
              {cat.links.map((link, lIdx) => (
                <div
                  key={link.id}
                  style={hoveredCategory === cat.id ? getRadialStyle(lIdx, cat.links.length + 1, 100, 0) : { opacity: 0, scale: 0 }}
                  className={`absolute flex h-10 w-32 items-center justify-between px-2 rounded-lg border border-[#e028ff]/30 bg-slate-900/95 text-[10px] text-white backdrop-blur-md transition-all duration-300 pointer-events-auto hover:border-[#e028ff] shadow-[0_0_10px_rgba(224,40,255,0.3)] group/link`}
                >
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:text-[#e028ff] transition-colors">
                    {link.name}
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLink(cat.id, link.id); }}
                    className="ms-1 text-red-400 hover:text-red-600 font-bold text-sm opacity-0 group-hover/link:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Add Link Button in Sub-menu */}
              <button
                onClick={(e) => { e.stopPropagation(); addLink(cat.id); }}
                style={hoveredCategory === cat.id ? getRadialStyle(cat.links.length, cat.links.length + 1, 100, 0) : { opacity: 0, scale: 0 }}
                className={`absolute flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[#e028ff]/50 bg-slate-900/50 text-[#e028ff] backdrop-blur-md transition-all duration-300 pointer-events-auto hover:bg-[#e028ff] hover:text-white shadow-[0_0_10px_rgba(224,40,255,0.2)]`}
                title="إضافة رابط"
              >
                +
              </button>
            </div>
          </div>
        ))}

        {/* Add Category Button */}
        <button
          onClick={addCategory}
          style={isHovered ? getRadialStyle(categories.length, categories.length + 1, 130) : { opacity: 0, scale: 0 }}
          className={`absolute flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[#00f3ff]/50 bg-slate-900/50 text-[#00f3ff] backdrop-blur-md transition-all duration-300 pointer-events-auto hover:bg-[#00f3ff] hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.2)]`}
          title="إضافة قسم"
        >
          +
        </button>
      </div>
    </div>
  );
}
