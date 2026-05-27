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
  color: string;
  links: CustomLink[];
}

const COLORS = ["#3498db", "#f39c12", "#2ecc71", "#e74c3c", "#9b59b6", "#1abc9c", "#e67e22", "#34495e"];

export function FloatingAdminMenu() {
  const [position, setPosition] = useState({ x: 50, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  // Dimensions for "AnyDesk" tight adherence
  const btnSize = 56; // w-14 in tailwind
  const innerRadius = 28; // Matches button perfectly (56/2)
  const outerRadius = 130;
  const subRingRadius = 220;

  // Load state from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("kse_admin_floating_data");
    if (savedData) {
      try {
        setCategories(JSON.parse(savedData));
      } catch (e) {
        console.error("Error loading categories", e);
      }
    }
    const savedPos = localStorage.getItem("kse_admin_floating_pos");
    if (savedPos) {
      try {
        setPosition(JSON.parse(savedPos));
      } catch (e) {}
    }
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem("kse_admin_floating_data", JSON.stringify(categories));
  }, [categories]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isHovered && !isDragging) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
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
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x1} ${y1} A ${or} ${or} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  const addCategory = (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = window.prompt("اسم القسم الجديد:");
    if (name) {
      const newCat: CustomCategory = {
        id: Date.now().toString(),
        name,
        color: COLORS[categories.length % COLORS.length],
        links: [],
      };
      setCategories([...categories, newCat]);
    }
  };

  const addLink = (e: React.MouseEvent, catId: string) => {
    e.stopPropagation();
    const name = window.prompt("اسم الرابط:");
    const url = window.prompt("الرابط (URL):");
    if (name && url) {
      setCategories(prev => prev.map(cat => cat.id === catId ? { ...cat, links: [...cat.links, { id: Date.now().toString(), name, url }] } : cat));
    }
  };

  const deleteCategory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("حذف هذا القسم بجميع روابطه؟")) {
      setCategories(categories.filter(c => c.id !== id));
      if (hoveredCategory === id) setHoveredCategory(null);
    }
  };

  const deleteLink = (e: React.MouseEvent, catId: string, linkId: string) => {
    e.stopPropagation();
    if (confirm("حذف هذا الرابط؟")) {
      setCategories(prev => prev.map(cat => cat.id === catId ? { ...cat, links: cat.links.filter(l => l.id !== linkId) } : cat));
    }
  };

  const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const totalAngle = 260;
  const startAngle = isLeft ? 50 : 250;
  const count = categories.length + 1; // slices + the '+' slice
  const step = totalAngle / count;

  return (
    <div
      className="fixed z-[9999] touch-none select-none flex items-center justify-center"
      style={{ left: position.x, top: position.y }}
      onMouseLeave={() => {
        if (!isDragging) {
          setIsHovered(false);
          setHoveredCategory(null);
        }
      }}
    >
      {/* Radial Menu SVG */}
      <div className={`absolute transition-all duration-300 transform-gpu ${isHovered ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"}`}>
        <svg width="600" height="600" viewBox="-300 -300 600 600" className="overflow-visible drop-shadow-2xl">
          {/* Inner Ring: Categories */}
          {categories.map((cat, i) => {
            const sA = startAngle + (i * step);
            const eA = sA + step - 1.5;
            const midA = (sA + eA) / 2;
            const tx = Math.cos((midA - 90) * Math.PI / 180) * ((innerRadius + outerRadius) / 2);
            const ty = Math.sin((midA - 90) * Math.PI / 180) * ((innerRadius + outerRadius) / 2);

            return (
              <g key={cat.id} className="cursor-pointer group" onMouseEnter={() => setHoveredCategory(cat.id)}>
                <path
                  d={getArcPath(sA, eA, innerRadius, outerRadius)}
                  fill={cat.color}
                  stroke="#121212"
                  strokeWidth="1.5"
                  className="transition-all hover:brightness-110"
                />
                <foreignObject x={tx - 35} y={ty - 15} width="70" height="30" className="pointer-events-none">
                  <div className="flex items-center justify-center w-full h-full text-[11px] font-black text-white text-center leading-tight drop-shadow-sm px-1">
                    {cat.name}
                  </div>
                </foreignObject>

                {/* Delete Category Button (Visible on hover) */}
                <circle
                  cx={Math.cos((sA - 90) * Math.PI / 180) * outerRadius}
                  cy={Math.sin((sA - 90) * Math.PI / 180) * outerRadius}
                  r="9"
                  fill="#ef4444"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => deleteCategory(e, cat.id)}
                />
                <text
                  x={Math.cos((sA - 90) * Math.PI / 180) * outerRadius}
                  y={Math.sin((sA - 90) * Math.PI / 180) * outerRadius}
                  fill="white" fontSize="10" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none opacity-0 group-hover:opacity-100"
                >×</text>

                {/* Outer Ring: Links (Only for hovered category) */}
                {hoveredCategory === cat.id && (
                  <g className="animate-in fade-in zoom-in duration-200">
                    {cat.links.map((link, li) => {
                      const lStep = (eA - sA) / (cat.links.length + 1);
                      const lsA = sA + (li * lStep);
                      const leA = lsA + lStep - 0.5;
                      const lmA = (lsA + leA) / 2;
                      const ltx = Math.cos((lmA - 90) * Math.PI / 180) * ((outerRadius + subRingRadius) / 2);
                      const lty = Math.sin((lmA - 90) * Math.PI / 180) * ((outerRadius + subRingRadius) / 2);

                      return (
                        <g key={link.id} className="cursor-pointer group/link">
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            <path
                              d={getArcPath(lsA, leA, outerRadius + 2, subRingRadius)}
                              fill="#2c3e50"
                              stroke="#121212"
                              strokeWidth="1"
                              className="hover:fill-[#34495e] transition-colors"
                            />
                            <text
                              x={ltx} y={lty}
                              fill="white" fontSize="10" fontWeight="black" textAnchor="middle" alignmentBaseline="middle"
                              className="pointer-events-none"
                            >
                              {link.name}
                            </text>
                          </a>
                          {/* Delete Link Button */}
                          <circle
                            cx={Math.cos((lsA - 90) * Math.PI / 180) * subRingRadius}
                            cy={Math.sin((lsA - 90) * Math.PI / 180) * subRingRadius}
                            r="7"
                            fill="#ef4444"
                            className="opacity-0 group-hover/link:opacity-100 transition-opacity"
                            onClick={(e) => deleteLink(e, cat.id, link.id)}
                          />
                        </g>
                      );
                    })}
                    {/* Add Link (+) Segment */}
                    <g onClick={(e) => addLink(e, cat.id)} className="cursor-pointer hover:brightness-125">
                       <path
                          d={getArcPath(eA - (eA - sA) / (cat.links.length + 1), eA, outerRadius + 2, subRingRadius)}
                          fill="rgba(255,255,255,0.15)"
                          stroke="#ffffff44"
                       />
                       <text
                          x={Math.cos((eA - (eA - sA) / (2 * (cat.links.length + 1)) - 90) * Math.PI / 180) * (outerRadius + 40)}
                          y={Math.sin((eA - (eA - sA) / (2 * (cat.links.length + 1)) - 90) * Math.PI / 180) * (outerRadius + 40)}
                          fill="#ccc" fontSize="18" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle"
                          className="pointer-events-none"
                       >+</text>
                    </g>
                  </g>
                )}
              </g>
            );
          })}

          {/* Add Category (+) Segment */}
          <g onClick={addCategory} className="cursor-pointer group hover:brightness-150">
            <path
              d={getArcPath(startAngle + (categories.length * step), startAngle + (categories.length * step) + step - 1.5, innerRadius, outerRadius)}
              fill="rgba(255,255,255,0.05)"
              stroke="#666"
              strokeDasharray="4 2"
              className="group-hover:fill-white/10 transition-colors"
            />
            <text
              x={Math.cos((startAngle + (categories.length * step) + step / 2 - 90) * Math.PI / 180) * (innerRadius + 45)}
              y={Math.sin((startAngle + (categories.length * step) + step / 2 - 90) * Math.PI / 180) * (innerRadius + 45)}
              fill="#888" fontSize="28" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle"
              className="group-hover:fill-white pointer-events-none"
            >+</text>
          </g>
        </svg>
      </div>

      {/* Main Trigger Button (Diamond Style - Stays Center) */}
      <div
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        className={`relative z-[100] flex h-14 w-14 items-center justify-center shadow-2xl transition-all duration-300 ${
          isDragging ? "cursor-grabbing scale-95" : "cursor-grab"
        } ${isHovered ? "bg-[#00f3ff] rotate-45 scale-90 border-2 border-white/50" : "bg-white rounded-2xl rotate-0"}`}
      >
        <div className={`transition-transform duration-300 flex flex-col items-center justify-center gap-1 ${isHovered ? "-rotate-45" : ""}`}>
           {isHovered ? (
             <span className="text-xl font-black text-black">✕</span>
           ) : (
             <>
               <div className="w-5 h-5 bg-slate-800 rotate-45 shadow-sm" />
               <div className="w-5 h-5 bg-slate-800 rotate-45 shadow-sm -mt-1.5" />
             </>
           )}
        </div>
      </div>
    </div>
  );
}
