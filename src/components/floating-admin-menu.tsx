"use client";

import React, { useState, useEffect } from "react";

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
      setCategories([{ id: "delegates", name: "المندوبين", links: [] }]);
    }

    const savedPos = localStorage.getItem("kse_admin_floating_pos");
    if (savedPos) {
      try {
        setPosition(JSON.parse(savedPos));
      } catch {}
    }
  }, []);

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

  const getRadialStyle = (index: number, total: number, radius: number, angleOffset: number = 0) => {
    if (total === 0) return {};
    const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);

    // Half circle arc - tight and fan-like
    const angleRange = 160;
    const baseAngle = isLeft ? -80 : 100;

    const step = total > 1 ? angleRange / (total - 1) : 0;
    const angle = baseAngle + (index * step) + angleOffset;

    const radian = (angle * Math.PI) / 180;
    const tx = Math.cos(radian) * radius;
    const ty = Math.sin(radian) * radius;

    return {
      transform: `translate(${tx}px, ${ty}px)`,
      transitionDelay: `${index * 10}ms`,
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
      {/* Main Button */}
      <button
        onMouseDown={handleMouseDown}
        className={`relative z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#00f3ff] text-black shadow-lg transition-all duration-300 active:scale-95 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${isHovered ? "scale-105 bg-[#009edc] text-white" : ""}`}
      >
        <span className="text-2xl font-black">{isHovered ? "✕" : "⚙️"}</span>
      </button>

      {/* Radial Menu - Categories */}
      <div className={`absolute left-7 top-7 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            style={isHovered ? getRadialStyle(idx, categories.length + 1, 56) : {}} // radius 56 makes them touch the edges of the 56px button
            className={`absolute flex h-14 w-14 items-center justify-center rounded-full bg-[#009edc] text-[10px] font-bold text-white border-2 border-[#131418] shadow-md transition-all duration-200 pointer-events-auto hover:bg-[#00f3ff] hover:text-black hover:scale-110 group/cat`}
            onMouseEnter={() => setHoveredCategory(cat.id)}
          >
            <span className="text-center leading-tight px-1 break-words">{cat.name}</span>

            <button
              onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}
              className="absolute -top-1 -right-1 hidden group-hover/cat:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] shadow-lg border border-white"
            >
              ×
            </button>

            {/* Sub-menu for Links (Very close to category) */}
            <div className={`absolute inset-0 pointer-events-none`}>
              {cat.links.map((link, lIdx) => (
                <div
                  key={link.id}
                  style={hoveredCategory === cat.id ? getRadialStyle(lIdx, cat.links.length + 1, 54, 0) : { opacity: 0, scale: 0 }}
                  className={`absolute flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-[9px] text-white border-2 border-[#131418] shadow-lg transition-all duration-200 pointer-events-auto hover:bg-[#e028ff] hover:scale-110 group/link overflow-hidden`}
                >
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-center leading-tight px-1 w-full h-full flex items-center justify-center font-bold">
                    {link.name}
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeLink(cat.id, link.id); }}
                    className="absolute top-0 right-0 hidden group-hover/link:flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-white text-[7px]"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Add Link Button in Sub-menu */}
              <button
                onClick={(e) => { e.stopPropagation(); addLink(cat.id); }}
                style={hoveredCategory === cat.id ? getRadialStyle(cat.links.length, cat.links.length + 1, 54, 0) : { opacity: 0, scale: 0 }}
                className={`absolute flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-[#00f3ff] border border-dashed border-[#00f3ff]/50 transition-all duration-200 pointer-events-auto hover:bg-[#e028ff] hover:text-white`}
              >
                +
              </button>
            </div>
          </div>
        ))}

        {/* Add Category Button */}
        <button
          onClick={addCategory}
          style={isHovered ? getRadialStyle(categories.length, categories.length + 1, 56) : {}}
          className={`absolute flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-[#00f3ff] border-2 border-dashed border-[#00f3ff]/30 transition-all duration-200 pointer-events-auto hover:bg-[#00f3ff] hover:text-black shadow-lg`}
          title="إضافة قسم"
        >
          <span className="text-xl">+</span>
        </button>
      </div>
    </div>
  );
}
