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
  const count = categories.length + 2; // +1 for settings, +1 for add
  const step = totalAngle / count;

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
                        const totalLinks = cat.links.length + 1; // الروابط + زر الإضافة
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

                              return (
                                <g
                                  key={link.id}
                                  className="group/link cursor-pointer pointer-events-auto"
                                  onMouseEnter={handleMouseEnter}
                                  onClick={(e) => { e.stopPropagation(); window.open(link.url, "_blank"); }}
                                >
                                  <path
                                    d={getArcPath(lsA, leA, outerRadius + 4, subRingRadius)}
                                    fill="#1e293b"
                                    stroke="white"
                                    strokeWidth="0.5"
                                    className="hover:fill-slate-700 transition-colors shadow-xl"
                                  />
                                  <text x={ltx} y={lty} fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none uppercase">
                                    {link.name.substring(0,12)}
                                  </text>

                                  {/* Delete Link Button */}
                                  <circle
                                    cx={Math.cos((lsA-90)*Math.PI/180)*subRingRadius}
                                    cy={Math.sin((lsA-90)*Math.PI/180)*subRingRadius}
                                    r="9"
                                    fill="#ef4444"
                                    className="opacity-0 group-hover/link:opacity-100 transition-opacity shadow-lg cursor-pointer"
                                    onClick={(e)=>{
                                      e.stopPropagation();
                                      if(confirm("هل تريد حذف هذا الرابط؟")) {
                                        setCategories(prev=>prev.map(c=>c.id===cat.id?{...c,links:c.links.filter(l=>l.id!==link.id)}:c))
                                      }
                                    }}
                                  />
                                  <text
                                    x={Math.cos((lsA-90)*Math.PI/180)*subRingRadius}
                                    y={Math.sin((lsA-90)*Math.PI/180)*subRingRadius}
                                    fill="white"
                                    fontSize="11"
                                    fontWeight="black"
                                    textAnchor="middle"
                                    alignmentBaseline="middle"
                                    className="pointer-events-none opacity-0 group-hover/link:opacity-100"
                                  >×</text>
                                </g>
                              );
                            })}

                            {/* Enhanced Add Link Button (+) */}
                            {(() => {
                              const lsA = subStartAngle + (cat.links.length * linkStep);
                              const leA = lsA + linkStep - 2;
                              const lmidA = (lsA + leA) / 2;
                              const lmidRad = (lmidA - 90) * Math.PI / 180;
                              const ltx = Math.cos(lmidRad) * ((outerRadius + subRingRadius) / 2);
                              const lty = Math.sin(lmidRad) * ((outerRadius + subRingRadius) / 2);
                              return (
                                <g
                                  onMouseEnter={handleMouseEnter}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                                    const n=prompt("اسم الرابط:");
                                    const u=prompt("URL:");
                                    if(n&&u) setCategories(prev=>prev.map(c=>c.id===cat.id?{...c,links:[...c.links,{id:Date.now().toString(),name:n,url:u}]}:c));
                                    setIsHovered(true);
                                  }}
                                  className="cursor-pointer pointer-events-auto"
                                >
                                  <path
                                    d={getArcPath(lsA, leA, outerRadius + 4, subRingRadius)}
                                    fill="#10b981"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    className="hover:brightness-110 transition-all shadow-lg"
                                  />
                                  <text x={ltx} y={lty} fill="white" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none">
                                    <tspan x={ltx} dy="-3" fontSize="14" fontWeight="900">+</tspan>
                                    <tspan x={ltx} dy="11" fontSize="7" fontWeight="900">إضافة</tspan>
                                  </text>
                                </g>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </g>
                  )}
                  {/* Delete Category Button */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <circle cx={Math.cos((sA-90)*Math.PI/180)*outerRadius} cy={Math.sin((sA-90)*Math.PI/180)*outerRadius} r="10" fill="#ef4444" onClick={(e)=>{e.stopPropagation(); if(confirm("حذف القسم؟")) setCategories(categories.filter(c=>c.id!==cat.id))}} />
                    <text x={Math.cos((sA-90)*Math.PI/180)*outerRadius} y={Math.sin((sA-90)*Math.PI/180)*outerRadius} fill="white" fontSize="14" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none">×</text>
                  </g>

                  {/* Color Cycle Button */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <circle
                      cx={Math.cos((eA-90)*Math.PI/180)*outerRadius}
                      cy={Math.sin((eA-90)*Math.PI/180)*outerRadius}
                      r="10"
                      fill="white"
                      stroke="#444"
                      strokeWidth="1"
                      onClick={(e)=>{
                        e.stopPropagation();
                        const currentIndex = COLORS.indexOf(cat.color);
                        const nextColor = COLORS[(currentIndex + 1) % COLORS.length];
                        setCategories(prev => prev.map(c => c.id === cat.id ? {...c, color: nextColor} : c));
                      }}
                    />
                    <circle
                      cx={Math.cos((eA-90)*Math.PI/180)*outerRadius}
                      cy={Math.sin((eA-90)*Math.PI/180)*outerRadius}
                      r="6"
                      fill={cat.color}
                      className="pointer-events-none"
                    />
                  </g>

                  {/* Edit Icon/Name Button */}
                  <g className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <circle
                      cx={Math.cos(((sA+eA)/2 - 90)*Math.PI/180)*(outerRadius + 12)}
                      cy={Math.sin(((sA+eA)/2 - 90)*Math.PI/180)*(outerRadius + 12)}
                      r="10"
                      fill="white"
                      stroke="#444"
                      strokeWidth="1"
                      onClick={(e)=>{
                        e.stopPropagation();
                        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                        const newName = prompt("اسم القسم الجديد:", cat.name);
                        let newIcon = prompt("أيقونة القسم (Emoji):", cat.icon);

                        // Prevent folder icons during edit
                        const folderEmojis = ["📂", "📁", "🗂️", "💼", "🗄️"];
                        if (newIcon && folderEmojis.includes(newIcon.trim())) {
                            newIcon = "";
                        }

                        if(newName !== null || newIcon !== null) {
                          setCategories(prev => prev.map(c => c.id === cat.id ? {
                            ...c,
                            name: newName !== null ? (newName || c.name) : c.name,
                            icon: newIcon !== null ? newIcon : c.icon
                          } : c));
                        }
                        setIsHovered(true);
                      }}
                    />
                    <text
                      x={Math.cos(((sA+eA)/2 - 90)*Math.PI/180)*(outerRadius + 12)}
                      y={Math.sin(((sA+eA)/2 - 90)*Math.PI/180)*(outerRadius + 12)}
                      fontSize="10"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="pointer-events-none"
                    >
                      ✏️
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Settings Segment (⚙️) */}
            {(() => {
              const i = categories.length;
              const sA = startAngle + (i * step);
              const eA = sA + step - 1;
              const midA = (sA + eA) / 2;
              const midRad = (midA - 90) * Math.PI / 180;
              const tx = Math.cos(midRad) * ((innerRadius + outerRadius) / 2);
              const ty = Math.sin(midRad) * ((innerRadius + outerRadius) / 2);
              return (
                <g
                  onMouseEnter={() => { handleMouseEnter(); setHoveredCategory("system_settings"); }}
                  onClick={(e) => { e.stopPropagation(); setHoveredCategory(hoveredCategory === "system_settings" ? null : "system_settings"); }}
                  className="cursor-pointer group pointer-events-auto"
                >
                  <path d={getArcPath(sA, eA, innerRadius, outerRadius)} fill="#475569" stroke="#000" strokeWidth="0.5" className="hover:fill-slate-500 transition-all" />
                  <text x={tx} y={ty} textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none select-none">
                     <tspan x={tx} dy="0" fontSize="18">⚙️</tspan>
                  </text>

                  {/* Settings Sub Ring */}
                  {hoveredCategory === "system_settings" && (
                    <g className="animate-in fade-in zoom-in duration-200">
                       {/* Lock Toggle */}
                       {(() => {
                          const lStep = (eA - sA) / 3;
                          const lsA = sA;
                          const leA = lsA + lStep - 0.5;
                          const lmidA = (lsA + leA) / 2;
                          const lmidRad = (lmidA - 90) * Math.PI / 180;
                          const ltx = Math.cos(lmidRad) * ((outerRadius + subRingRadius)/2);
                          const lty = Math.sin(lmidRad) * ((outerRadius + subRingRadius)/2);
                          return (
                            <g className="cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); setIsLocked(!isLocked); }}>
                              <path d={getArcPath(lsA, leA, outerRadius + 2, subRingRadius)} fill={isLocked ? "#ef4444" : "#10b981"} className="hover:brightness-110 transition-all" />
                              <text x={ltx} y={lty} fill="white" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none">
                                <tspan x={ltx} dy="-2" fontSize="12">{isLocked ? "🔒" : "🔓"}</tspan>
                                <tspan x={ltx} dy="10" fontSize="6" fontWeight="bold" className="uppercase">{isLocked ? "Unlock" : "Lock"}</tspan>
                              </text>
                            </g>
                          )
                       })()}
                       {/* Scale Cycle */}
                       {(() => {
                          const lStep = (eA - sA) / 3;
                          const lsA = sA + lStep;
                          const leA = lsA + lStep - 0.5;
                          const lmidA = (lsA + leA) / 2;
                          const lmidRad = (lmidA - 90) * Math.PI / 180;
                          const ltx = Math.cos(lmidRad) * ((outerRadius + subRingRadius)/2);
                          const lty = Math.sin(lmidRad) * ((outerRadius + subRingRadius)/2);
                          return (
                            <g className="cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); setMenuScale(prev => prev >= 1.5 ? 0.5 : prev + 0.25); }}>
                              <path d={getArcPath(lsA, leA, outerRadius + 2, subRingRadius)} fill="#3b82f6" className="hover:brightness-110 transition-all" />
                              <text x={ltx} y={lty} fill="white" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none">
                                <tspan x={ltx} dy="-2" fontSize="12">📏</tspan>
                                <tspan x={ltx} dy="10" fontSize="6" fontWeight="bold" className="uppercase">{menuScale}x</tspan>
                              </text>
                            </g>
                          )
                       })()}
                       {/* Reset Data */}
                       {(() => {
                          const lStep = (eA - sA) / 3;
                          const lsA = sA + (2 * lStep);
                          const leA = lsA + lStep - 0.5;
                          const lmidA = (lsA + leA) / 2;
                          const lmidRad = (lmidA - 90) * Math.PI / 180;
                          const ltx = Math.cos(lmidRad) * ((outerRadius + subRingRadius)/2);
                          const lty = Math.sin(lmidRad) * ((outerRadius + subRingRadius)/2);
                          return (
                            <g className="cursor-pointer pointer-events-auto" onClick={(e) => {
                              e.stopPropagation();
                              if(confirm("إعادة تعيين كافة البيانات؟")) {
                                setCategories([]);
                                setMenuScale(1);
                                setIsLocked(false);
                                setPosition({ x: 80, y: 300 });
                                localStorage.removeItem("kse_admin_floating_pos");
                              }
                            }}>
                              <path d={getArcPath(lsA, leA, outerRadius + 2, subRingRadius)} fill="#475569" className="hover:fill-red-600 transition-colors" />
                              <text x={ltx} y={lty} fill="white" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none">
                                <tspan x={ltx} dy="-2" fontSize="12">🔄</tspan>
                                <tspan x={ltx} dy="10" fontSize="6" fontWeight="bold">RESET</tspan>
                              </text>
                            </g>
                          )
                       })()}
                    </g>
                  )}
                </g>
              )
            })()}

            {/* Add Category Slot (+) */}
            <g
              onMouseEnter={handleMouseEnter}
              onClick={(e) => {
                e.stopPropagation();
                if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                const n=prompt("اسم القسم الجديد:");
                if(n) setCategories([...categories,{id:Date.now().toString(),name:n,icon:"",color:COLORS[categories.length%COLORS.length],links:[]}]);
                setIsHovered(true);
              }}
              className="cursor-pointer group pointer-events-auto"
            >
              <path
                d={getArcPath(startAngle+((categories.length+1)*step), startAngle+((categories.length+1)*step)+step-1, innerRadius, outerRadius)}
                fill="#3b82f6"
                stroke="white"
                strokeWidth="2"
                className="hover:brightness-110 transition-all"
              />
              <text
                x={Math.cos((startAngle+((categories.length+1)*step)+step/2-90)*Math.PI/180)*((innerRadius+outerRadius)/2)}
                y={Math.sin((startAngle+((categories.length+1)*step)+step/2-90)*Math.PI/180)*((innerRadius+outerRadius)/2)}
                fill="white"
                textAnchor="middle"
                alignmentBaseline="middle"
                className="pointer-events-none transition-all"
              >
                <tspan x={Math.cos((startAngle+((categories.length+1)*step)+step/2-90)*Math.PI/180)*((innerRadius+outerRadius)/2)} dy="-2" fontSize="24" fontWeight="bold">+</tspan>
                <tspan x={Math.cos((startAngle+((categories.length+1)*step)+step/2-90)*Math.PI/180)*((innerRadius+outerRadius)/2)} dy="14" fontSize="8" fontWeight="bold">إضافة قسم</tspan>
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
