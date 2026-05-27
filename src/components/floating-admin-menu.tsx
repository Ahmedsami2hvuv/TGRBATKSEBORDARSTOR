"use client";

import React, { useState, useEffect } from "react";

interface CustomLink {
  id: string;
  name: string;
  url: string;
  icon?: string;
}

interface CustomCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  links: CustomLink[];
}

const DEFAULT_CATEGORIES: CustomCategory[] = [
  { id: "1", name: "أدوات", color: "#3498db", icon: "🔧", links: [
      { id: "l1", name: "F1", url: "#", icon: "⌨️" },
      { id: "l2", name: "كيبورد", url: "#", icon: "⌨️" }
  ]},
  { id: "2", name: "تحكم", color: "#f39c12", icon: "⌨️", links: [] },
  { id: "3", name: "عرض", color: "#3498db", icon: "🖥️", links: [] },
  { id: "4", name: "خروج", color: "#3498db", icon: "➡️", links: [] },
  { id: "5", name: "دردشة", color: "#3498db", icon: "💬", links: [] },
  { id: "6", name: "كهرباء", color: "#3498db", icon: "⚡", links: [] },
  { id: "7", name: "ملفات", color: "#2ecc71", icon: "📁", links: [] },
  { id: "8", name: "إعدادات", color: "#95a5a6", icon: "👆", links: [] },
  { id: "9", name: "حذف", color: "#e74c3c", icon: "✕", links: [] },
];

export function FloatingAdminMenu() {
  const [position, setPosition] = useState({ x: 40, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  const innerR = 45;
  const outerR = 130;
  const subR = 210;

  useEffect(() => {
    const saved = localStorage.getItem("kse_admin_floating_links");
    if (saved) {
      try { setCategories(JSON.parse(saved)); } catch { setCategories(DEFAULT_CATEGORIES); }
    } else {
      setCategories(DEFAULT_CATEGORIES);
    }
    const savedPos = localStorage.getItem("kse_admin_floating_pos");
    if (savedPos) {
      try { setPosition(JSON.parse(savedPos)); } catch {}
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
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
  }, [isDragging, dragOffset]);

  const getArcPath = (startAngle: number, endAngle: number, ir: number, or: number) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180.0;
    const endRad = ((endAngle - 90) * Math.PI) / 180.0;
    const x1 = Math.cos(startRad) * or;
    const y1 = Math.sin(startRad) * or;
    const x2 = Math.cos(endRad) * or;
    const y2 = Math.sin(endRad) * or;
    const x3 = Math.cos(endRad) * ir;
    const y3 = Math.sin(endRad) * ir;
    const x4 = Math.cos(startRad) * ir;
    const y4 = Math.sin(startRad) * ir;
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x1} ${y1} A ${or} ${or} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const angleRange = 220;
  const startAngle = isLeft ? 70 : 250;
  const step = angleRange / categories.length;

  return (
    <div className="fixed z-[9999] touch-none select-none" style={{ left: position.x, top: position.y }}>

      {/* Radial Menu SVG */}
      <div className={`absolute transition-all duration-500 ease-out ${isHovered ? "opacity-100 scale-100" : "opacity-0 scale-0 pointer-events-none"}`}
           style={{ transform: "translate(-50%, -50%)" }}>
        <svg width="500" height="500" viewBox="-250 -250 500 500" className="overflow-visible drop-shadow-2xl">
          {categories.map((cat, i) => {
            const sA = startAngle + (i * step);
            const eA = sA + step;
            const midA = (sA + eA) / 2;
            const iconR = (innerR + outerR) / 2;
            const ix = Math.cos((midA - 90) * Math.PI / 180) * iconR;
            const iy = Math.sin((midA - 90) * Math.PI / 180) * iconR;

            return (
              <g key={cat.id} className="group cursor-pointer" onMouseEnter={() => setHoveredCategory(cat.id)}>
                <path d={getArcPath(sA, eA, innerR, outerR)} fill={cat.color} stroke="#1a1a1a" strokeWidth="1" className="hover:brightness-110 transition-all"/>
                <text x={ix} y={iy} fill="white" fontSize="20" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none drop-shadow-sm">
                  {cat.icon}
                </text>

                {/* Outer Ring for Links */}
                {hoveredCategory === cat.id && cat.links.map((link, li) => {
                  const lsA = sA + (li * (step/cat.links.length));
                  const leA = lsA + (step/cat.links.length);
                  const lmidA = (lsA + leA) / 2;
                  const lix = Math.cos((lmidA - 90) * Math.PI / 180) * (outerR + 40);
                  const liy = Math.sin((lmidA - 90) * Math.PI / 180) * (outerR + 40);
                  return (
                    <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                      <path d={getArcPath(lsA, leA, outerR + 2, subR)} fill="#2980b9" stroke="#1a1a1a" strokeWidth="1" className="hover:fill-[#3498db] transition-all"/>
                      <text x={lix} y={liy} fill="white" fontSize="14" textAnchor="middle" alignmentBaseline="middle">
                        {link.icon || "🔗"}
                      </text>
                    </a>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Center Diamond Button (AnyDesk Style) */}
      <div
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        className={`relative z-50 flex h-14 w-14 items-center justify-center shadow-xl transition-all duration-300 border-2 border-slate-800/20 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${isHovered ? "bg-[#00d1ff] rotate-45 scale-90" : "bg-white rounded-xl rotate-0"}`}
      >
        <div className={`transition-transform duration-300 flex flex-col items-center ${isHovered ? "-rotate-45" : ""}`}>
           {isHovered ? (
             <span className="text-xl font-bold text-white">✕</span>
           ) : (
             <div className="flex flex-col items-center leading-none">
                <div className="w-4 h-4 bg-slate-800 rotate-45 mb-1" />
                <div className="w-4 h-4 bg-slate-800 rotate-45" />
             </div>
           )}
        </div>
      </div>

      {/* Backdrop to close when clicking outside */}
      {isHovered && (
        <div className="fixed inset-0 -z-10" onClick={() => { setIsHovered(false); setHoveredCategory(null); }} />
      )}
    </div>
  );
}
