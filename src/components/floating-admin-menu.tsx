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
  const dragStartTime = useRef(0);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  // AnyDesk Ultra-Compact Dimensions
  const btnSize = 56;
  const innerRadius = 28; // Adheres perfectly to button (56/2)
  const outerRadius = 80; // Compact (was 100)
  const subRingRadius = 135; // Compact (was 170)

  // Persistence
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedData = localStorage.getItem("kse_admin_floating_data");
    if (savedData) try { setCategories(JSON.parse(savedData)); } catch(e){}
    const savedPos = localStorage.getItem("kse_admin_floating_pos");
    if (savedPos) try { setPosition(JSON.parse(savedPos)); } catch(e){}
    const savedLocked = localStorage.getItem("kse_admin_floating_locked");
    if (savedLocked) setIsLocked(savedLocked === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("kse_admin_floating_data", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem("kse_admin_floating_locked", isLocked.toString());
  }, [isLocked]);

  // Drag & Interaction Logic
  const startDrag = (clientX: number, clientY: number) => {
    if (isLocked) return;
    setIsDragging(true);
    setIsHovered(false);
    dragStartTime.current = Date.now();
    dragStartPos.current = { x: clientX, y: clientY };
    setDragOffset({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (isDragging) {
      const nx = Math.max(btnSize/2, Math.min(window.innerWidth - btnSize/2, clientX - dragOffset.x));
      const ny = Math.max(btnSize/2, Math.min(window.innerHeight - btnSize/2, clientY - dragOffset.y));
      setPosition({ x: nx, y: ny });
    }
  }, [isDragging, dragOffset]);

  const stopDrag = useCallback((clientX: number, clientY: number) => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem("kse_admin_floating_pos", JSON.stringify(position));

      const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));
      const duration = Date.now() - dragStartTime.current;

      // If it was a quick tap/click, toggle the menu
      if (dist < 10 && duration < 250) {
        setIsHovered(prev => !prev);
      }
    }
  }, [isDragging, position]);

  useEffect(() => {
    const mm = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const mu = (e: MouseEvent) => stopDrag(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => {
        if (isDragging) {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
            if (e.cancelable) e.preventDefault();
        }
    };
    const tu = (e: TouchEvent) => stopDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

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
  const count = categories.length + 1;
  const step = totalAngle / count;

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left: position.x, top: position.y }}
    >
      {/*
        Container for Hover Area:
        Creates a large invisible area to maintain the hover state.
      */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-auto flex items-center justify-center"
        style={{
            width: isHovered ? subRingRadius * 2.6 : btnSize + 20,
            height: isHovered ? subRingRadius * 2.6 : btnSize + 20,
            backgroundColor: "transparent"
        }}
        onMouseEnter={() => !isDragging && setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setHoveredCategory(null); }}
      >
        {/* Main Button (Always on Top for Draggable) */}
        <div
          onMouseDown={(e) => { e.stopPropagation(); startDrag(e.clientX, e.clientY); }}
          onTouchStart={(e) => { e.stopPropagation(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
          className={`relative z-[1000] flex h-14 w-14 items-center justify-center shadow-2xl transition-all duration-300 transform-gpu ${
            isDragging ? "cursor-grabbing scale-95" : "cursor-grab"
          } ${isHovered && !isDragging ? "bg-[#00f3ff] rotate-45 scale-90 border-2 border-white/50" : "bg-white rounded-2xl rotate-0"}`}
        >
          <div className="pointer-events-none transition-transform duration-300 flex items-center justify-center w-full h-full">
             {isHovered && !isDragging ? (
               <div className="flex flex-col items-center justify-center -rotate-45">
                 <span className="text-2xl font-black text-black select-none leading-none">✕</span>
                 <div
                   className="mt-1 pointer-events-auto cursor-pointer p-0.5 bg-black/5 rounded-full hover:bg-black/20 transition-colors"
                   onClick={(e) => { e.stopPropagation(); setIsLocked(!isLocked); }}
                   title={isLocked ? "Unlock Position" : "Lock Position"}
                 >
                   {isLocked ? "🔒" : "🔓"}
                 </div>
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

        {/* Radial Menu SVG */}
        <div className={`absolute transition-all duration-300 transform-gpu ${isHovered && !isDragging ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"}`}>
          <svg width="400" height="400" viewBox="-200 -200 400 400" className="overflow-visible drop-shadow-2xl pointer-events-none">
            {categories.map((cat, i) => {
              const sA = startAngle + (i * step);
              const eA = sA + step - 1;
              const midA = (sA + eA) / 2;
              const midRad = (midA - 90) * Math.PI / 180;
              const tx = Math.cos(midRad) * ((innerRadius + outerRadius) / 2);
              const ty = Math.sin(midRad) * ((innerRadius + outerRadius) / 2);

              return (
                <g
                  key={cat.id}
                  onMouseEnter={() => setHoveredCategory(cat.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoveredCategory(hoveredCategory === cat.id ? null : cat.id);
                  }}
                  className="cursor-pointer group pointer-events-auto"
                >
                  <path d={getArcPath(sA, eA, innerRadius, outerRadius)} fill={cat.color} stroke="#000" strokeWidth="0.5" className="hover:brightness-110 transition-all" />
                  <text x={tx} y={ty} textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none select-none">
                     <tspan x={tx} dy="-2" fontSize="16">{cat.icon || "📂"}</tspan>
                     <tspan x={tx} dy="12" fontSize="8" fill="white" fontWeight="900" className="uppercase">{cat.name.substring(0,8)}</tspan>
                  </text>

                  {/* Sub Links Ring (Outer) */}
                  {hoveredCategory === cat.id && (
                    <g className="animate-in fade-in zoom-in duration-200">
                      {cat.links.map((link, li) => {
                        const lStep = (eA - sA) / (cat.links.length + 1);
                        const lsA = sA + (li * lStep);
                        const leA = lsA + lStep - 0.5;
                        const ltx = Math.cos(((lsA+leA)/2 - 90)*Math.PI/180) * ((outerRadius + subRingRadius)/2);
                        const lty = Math.sin(((lsA+leA)/2 - 90)*Math.PI/180) * ((outerRadius + subRingRadius)/2);
                        return (
                          <g key={link.id} className="group/link cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); window.open(link.url, "_blank"); }}>
                            <path d={getArcPath(lsA, leA, outerRadius + 2, subRingRadius)} fill="#1e293b" className="hover:fill-slate-700 transition-colors" />
                            <text x={ltx} y={lty} fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" className="pointer-events-none uppercase">{link.name.substring(0,10)}</text>
                            <circle cx={Math.cos((lsA-90)*Math.PI/180)*subRingRadius} cy={Math.sin((lsA-90)*Math.PI/180)*subRingRadius} r="7" fill="#ef4444" className="opacity-0 group-hover/link:opacity-100 transition-opacity" onClick={(e)=>{e.stopPropagation(); setCategories(prev=>prev.map(c=>c.id===cat.id?{...c,links:c.links.filter(l=>l.id!==link.id)}:c))}} />
                          </g>
                        );
                      })}
                      {/* Add Link (+) Segment */}
                      <g onClick={(e) => {e.stopPropagation(); const n=prompt("اسم الرابط:"); const u=prompt("URL:"); if(n&&u) setCategories(prev=>prev.map(c=>c.id===cat.id?{...c,links:[...c.links,{id:Date.now().toString(),name:n,url:u}]}:c))}} className="cursor-pointer pointer-events-auto">
                        <path d={getArcPath(eA - (eA-sA)/(cat.links.length+1), eA, outerRadius + 2, subRingRadius)} fill="rgba(255,255,255,0.15)" className="hover:fill-white/30 transition-colors" />
                        <text x={Math.cos((eA - ((eA-sA)/(cat.links.length+1))/2 - 90)*Math.PI/180)*(outerRadius+30)} y={Math.sin((eA - ((eA-sA)/(cat.links.length+1))/2 - 90)*Math.PI/180)*(outerRadius+30)} fill="white" fontSize="22" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none">+</text>
                      </g>
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
                        const newName = prompt("اسم القسم الجديد:", cat.name);
                        const newIcon = prompt("أيقونة القسم (Emoji):", cat.icon);
                        if(newName || newIcon) {
                          setCategories(prev => prev.map(c => c.id === cat.id ? {
                            ...c,
                            name: newName || c.name,
                            icon: newIcon || c.icon
                          } : c));
                        }
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

            {/* Add Category Slot (+) */}
            <g onClick={(e) => {e.stopPropagation(); const n=prompt("اسم القسم الجديد:"); if(n) setCategories([...categories,{id:Date.now().toString(),name:n,icon:"📂",color:COLORS[categories.length%COLORS.length],links:[]}])}} className="cursor-pointer group pointer-events-auto">
              <path d={getArcPath(startAngle+(categories.length*step), startAngle+(categories.length*step)+step-1, innerRadius, outerRadius)} fill="rgba(255,255,255,0.02)" stroke="#555" strokeDasharray="4 2" className="hover:fill-white/10 transition-colors" />
              <text x={Math.cos((startAngle+(categories.length*step)+step/2-90)*Math.PI/180)*(innerRadius+35)} y={Math.sin((startAngle+(categories.length*step)+step/2-90)*Math.PI/180)*(innerRadius+35)} fill="#666" fontSize="30" textAnchor="middle" alignmentBaseline="middle" className="group-hover:fill-white pointer-events-none transition-colors">+</text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
