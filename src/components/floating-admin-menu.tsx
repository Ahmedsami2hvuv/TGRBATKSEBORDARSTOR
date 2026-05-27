"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

interface CustomLink {
  id: string;
  name: string;
  url: string;
}

interface CustomCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  links: CustomLink[];
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#64748b"];

export function FloatingAdminMenu() {
  const [position, setPosition] = useState({ x: 80, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [menuScale, setMenuScale] = useState(1);
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const dragStartTime = useRef(0);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  // AnyDesk Ultra-Compact Dimensions
  const btnSize = 56;
  const innerRadius = 28; // Adheres perfectly to button (56/2)
  const outerRadius = 80; // Compact (was 100)
  const subRingRadius = 135; // Compact (was 170)

  // Persistence & Data Cleanup
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedData = localStorage.getItem("kse_admin_floating_data");
    if (savedData) {
      try {
        let parsed = JSON.parse(savedData);
        // Nuclear cleanup: remove any folder emojis from existing data
        const folderEmojis = ["📂", "📁", "🗂️", "💼", "🗄️"];
        const cleaned = parsed.map((cat: any) => ({
          ...cat,
          icon: folderEmojis.includes(cat.icon?.trim()) ? "" : (cat.icon || ""),
          links: (cat.links || []).map((link: any) => ({
            ...link,
            name: link.name || "رابط"
          }))
        }));
        setCategories(cleaned);
      } catch(e){}
    }
    const savedPos = localStorage.getItem("kse_admin_floating_pos");
    if (savedPos) try { setPosition(JSON.parse(savedPos)); } catch(e){}
    const savedLocked = localStorage.getItem("kse_admin_floating_locked");
    if (savedLocked) setIsLocked(savedLocked === "true");
    const savedScale = localStorage.getItem("kse_admin_floating_scale");
    if (savedScale) setMenuScale(parseFloat(savedScale));
  }, []);

  useEffect(() => {
    localStorage.setItem("kse_admin_floating_data", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem("kse_admin_floating_locked", isLocked.toString());
  }, [isLocked]);

  useEffect(() => {
    localStorage.setItem("kse_admin_floating_scale", menuScale.toString());
  }, [menuScale]);

  // Drag & Interaction Logic
  const startDrag = (clientX: number, clientY: number) => {
    if (isLocked) return;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setIsDragging(true);
    setIsActuallyDragging(false);
    dragStartTime.current = Date.now();
    dragStartPos.current = { x: clientX, y: clientY };
    setDragOffset({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (isDragging) {
      const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));

      if (dist > 5 && !isActuallyDragging) {
        setIsActuallyDragging(true);
        setIsHovered(false);
      }

      if (dist > 5 || isActuallyDragging) {
        const nx = Math.max(btnSize/2, Math.min(window.innerWidth - btnSize/2, clientX - dragOffset.x));
        const ny = Math.max(btnSize/2, Math.min(window.innerHeight - btnSize/2, clientY - dragOffset.y));
        setPosition({ x: nx, y: ny });
      }
    }
  }, [isDragging, isActuallyDragging, dragOffset]);

  const stopDrag = useCallback((clientX: number, clientY: number, isTouch: boolean) => {
    if (isDragging) {
      setIsDragging(false);
      const wasActuallyDragging = isActuallyDragging;
      setIsActuallyDragging(false);

      localStorage.setItem("kse_admin_floating_pos", JSON.stringify(position));

      const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));
      const duration = Date.now() - dragStartTime.current;

      // If it was a quick tap/click and NOT a significant drag
      if (dist < 10 && duration < 250 && !wasActuallyDragging) {
        setIsHovered(prev => !prev);
      }
    }
  }, [isDragging, isActuallyDragging, position]);

  const handleMouseEnter = () => {
    if (isDragging) return;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      setIsHovered(false);
      setHoveredCategory(null);
    }, 400); // Increased to 400ms to prevent flickering as per AnyDesk logic
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const mu = (e: MouseEvent) => stopDrag(e.clientX, e.clientY, false);
    const tm = (e: TouchEvent) => {
        if (isDragging) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
            if (e.cancelable) e.preventDefault();
        }
    };
    const tu = (e: TouchEvent) => stopDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);

    if (isDragging) {
      window.addEventListener("mousemove", mm);
      window.addEventListener("mouseup", mu);
      window.addEventListener("touchmove", tm, { passive: false });
      window.addEventListener("touchend", tu);
    }
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", tu);
    };
  }, [isDragging, handleMove, stopDrag]);

  const getArcPath = (startAngle: number, endAngle: number, ir: number, or: number) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180.0;
    const endRad = ((endAngle - 90) * Math.PI) / 180.0;
    const x1 = Math.cos(startRad) * or; const y1 = Math.sin(startRad) * or;
    const x2 = Math.cos(endRad) * or;   const y2 = Math.sin(endRad) * or;
    const x3 = Math.cos(endRad) * ir;   const y3 = Math.sin(endRad) * ir;
    const x4 = Math.cos(startRad) * ir; const y4 = Math.sin(startRad) * ir;
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x1} ${y1} A ${or} ${or} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const totalAngle = 260;
  const startAngle = isLeft ? 50 : 250;
  const count = categories.length; // Removed +2 (settings and add)
  const step = count > 0 ? totalAngle / count : 0;

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        left: 0,
        top: 0,
        willChange: "transform"
      }}
    >
      {/*
        Container for Hover Area:
        The large container only catches pointer events when the menu is open.
      */}
      <div
        className="absolute rounded-full flex items-center justify-center bg-transparent pointer-events-none"
        style={{
            width: 450,
            height: 450,
            transform: `translate(-50%, -50%) scale(${menuScale})`,
            left: 0,
            top: 0,
            transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            touchAction: isDragging ? "none" : "auto"
        }}
      >
        {/* Main Button Container */}
        <div
            className="pointer-events-auto flex items-center justify-center"
            style={{ width: btnSize + 20, height: btnSize + 20, touchAction: isDragging ? "none" : "auto" }}
            onMouseEnter={() => {
                handleMouseEnter();
                setHoveredCategory(null);
            }}
            onMouseLeave={handleMouseLeave}
        >
          <div
            onMouseDown={(e) => { e.stopPropagation(); startDrag(e.clientX, e.clientY); }}
            onTouchStart={(e) => { e.stopPropagation(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
            className={`relative z-[1000] flex h-14 w-14 items-center justify-center shadow-2xl transform-gpu transition-all duration-300 ${
                isActuallyDragging ? "cursor-grabbing scale-95" : "cursor-grab"
            } ${isHovered && !isActuallyDragging ? "bg-[#00f3ff] rotate-45 scale-90 border-2 border-white/50" : "bg-white rounded-2xl rotate-0"}`}
            style={{
              transform: isHovered && !isActuallyDragging ? `rotate(45deg) scale(0.9)` : `scale(1)`,
              touchAction: "none"
            }}
          >
                <div className="pointer-events-none transition-transform duration-300 flex items-center justify-center w-full h-full">
                    {isHovered && !isActuallyDragging ? (
                    <div className="flex flex-col items-center justify-center -rotate-45">
                        <span className="text-3xl font-black text-black select-none leading-none">✕</span>
                    </div>
                    ) : (
                    <div className="grid grid-cols-2 gap-1 p-1">
                        <div className="w-2 h-2 bg-slate-800 rounded-sm" />
                        <div className="w-2 h-2 bg-slate-800 rounded-sm" />
                        <div className="w-2 h-2 bg-slate-800 rounded-sm" />
                        <div className="w-2 h-2 bg-slate-800 rounded-sm" />
                    </div>
                    )}
                </div>
            </div>
        </div>

        {/* Radial Menu SVG Container */}
        <div
          className={`absolute transition-all duration-300 transform-gpu ${
            isHovered && !isActuallyDragging ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-50 pointer-events-none"
          }`}
          style={{
            transform: isHovered && !isActuallyDragging ? "scale(1)" : "scale(0.5)"
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            width="450"
            height="450"
            viewBox="-225 -225 450 450"
            className="overflow-visible drop-shadow-2xl pointer-events-none"
          >
            {/* Hover Guard Circle: ensures no gaps between button and menu */}
            <circle
                r={subRingRadius + 20}
                fill="rgba(255,255,255,0.01)"
                className="pointer-events-auto"
                onMouseEnter={handleMouseEnter}
            />

            {categories.map((cat, i) => {
              const sA = startAngle + (i * step);
              const eA = sA + step - 1;
              const midA = (sA + eA) / 2;
              const midRad = (midA - 90) * Math.PI / 180;
              const tx = Math.cos(midRad) * ((innerRadius + outerRadius) / 2);
              const ty = Math.sin(midRad) * ((innerRadius + outerRadius) / 2);

              // Strict filter to ensure no folder emoji ever shows up
              const displayIcon = cat.icon && cat.icon.trim() !== "" && !["📂", "📁", "🗂️", "💼", "🗄️"].includes(cat.icon.trim()) ? cat.icon : null;

              return (
                <g
                  key={cat.id}
                  onMouseEnter={() => {
                    handleMouseEnter();
                    setHoveredCategory(cat.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoveredCategory(hoveredCategory === cat.id ? null : cat.id);
                  }}
                  className="cursor-pointer group pointer-events-auto"
                >
                  <path d={getArcPath(sA, eA, innerRadius, outerRadius)} fill={cat.color} stroke="#000" strokeWidth="0.5" className="hover:brightness-110 transition-all" />
                  <text x={tx} y={ty} textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none select-none">
                     {displayIcon ? (
                        <>
                           <tspan x={tx} dy="-6" fontSize="16">{displayIcon}</tspan>
                           <tspan x={tx} dy="14" fontSize="9" fill="white" fontWeight="900" className="uppercase">{cat.name.substring(0,10)}</tspan>
                        </>
                     ) : (
                        <tspan x={tx} dy="0" fontSize="11" fill="white" fontWeight="900" className="uppercase">{cat.name.substring(0,10)}</tspan>
                     )}
                  </text>

                  {/* Sub Links Ring (Outer) */}
                  {hoveredCategory === cat.id && (
                    <g className="animate-in fade-in zoom-in duration-200">
                      {(() => {
                        const linkStep = 32; // زاوية توزيع ثابتة لكل رابط
                        const totalLinks = cat.links.length;
                        const totalSubAngle = (totalLinks - 1) * linkStep;
                        const subStartAngle = midA - (totalSubAngle / 2);

                        return (
                          <>
                            {cat.links.map((link, li) => {
                              const lsA = subStartAngle + (li * linkStep);
                              const leA = lsA + linkStep - 2;
                              const lmidA = (lsA + leA) / 2;
                              const lmidRad = (lmidA - 90) * Math.PI / 180;
                              const ltx = Math.cos(lmidRad) * ((outerRadius + subRingRadius) / 2);
                              const lty = Math.sin(lmidRad) * ((outerRadius + subRingRadius) / 2);

                              // Automatic color for sub-links based on index
                              const subLinkColor = COLORS[li % COLORS.length];

                              return (
                                <g
                                  key={link.id}
                                  className="group/link cursor-pointer pointer-events-auto"
                                  onMouseEnter={handleMouseEnter}
                                  onClick={(e) => { e.stopPropagation(); window.open(link.url, "_blank"); }}
                                >
                                  <path
                                    d={getArcPath(lsA, leA, outerRadius + 4, subRingRadius)}
                                    fill={subLinkColor}
                                    stroke="white"
                                    strokeWidth="1"
                                    className="hover:brightness-110 transition-all shadow-xl"
                                  />
                                  <text x={ltx} y={lty} fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none uppercase drop-shadow-sm">
                                    {link.name.substring(0,12)}
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </g>
                  )}
                </g>
              );
            })}

          </svg>
        </div>
      </div>
    </div>
  );
}
