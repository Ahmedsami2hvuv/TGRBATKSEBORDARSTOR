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
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const isTouchDevice = useRef(false);

  const btnVisualSize = 56;
  const hitAreaSize = 120; // منطقة لمس واسعة جداً لضمان الاستجابة من كل الجهات
  const innerRadius = 28;
  const outerRadius = 80;
  const subRingRadius = 135;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadSaved = () => {
      const savedData = localStorage.getItem("kse_admin_floating_data");
      if (savedData) try { setCategories(JSON.parse(savedData)); } catch(e){}
      const savedPos = localStorage.getItem("kse_admin_floating_pos");
      if (savedPos) try { setPosition(JSON.parse(savedPos)); } catch(e){}
      const savedLocked = localStorage.getItem("kse_admin_floating_locked");
      if (savedLocked) setIsLocked(savedLocked === "true");
      const savedScale = localStorage.getItem("kse_admin_floating_scale");
      if (savedScale) setMenuScale(parseFloat(savedScale));
    };

    loadSaved();
    window.addEventListener("storage", loadSaved);

    fetch("/api/abo1stor3hlaa2kbr8-47/settings/floating-menu")
      .then(res => res.json())
      .then(data => {
        if (data.categories) setCategories(data.categories);
        if (data.isLocked !== undefined) setIsLocked(data.isLocked);
        if (data.menuScale !== undefined) setMenuScale(data.menuScale);
      })
      .catch(err => console.error("Failed to sync", err));
    return () => window.removeEventListener("storage", loadSaved);
  }, []);

  const updateActiveItemFromPoint = (x: number, y: number) => {
    if (typeof document === 'undefined') return;
    const elements = document.elementsFromPoint(x, y);
    let foundCatId = null;
    let foundLinkId = null;

    for (const el of elements) {
      if (!el) continue;
      const c = el.getAttribute('data-category-id');
      const l = el.getAttribute('data-link-id');
      if (c && !foundCatId) foundCatId = c;
      if (l && !foundLinkId) foundLinkId = l;
    }

    if (foundCatId) setHoveredCategory(foundCatId);
    setActiveLinkId(foundLinkId);
  };

  const startDrag = (clientX: number, clientY: number, isTouch: boolean) => {
    isTouchDevice.current = isTouch;
    setIsDragging(true);
    setIsActuallyDragging(false);
    dragStartTime.current = Date.now();
    dragStartPos.current = { x: clientX, y: clientY };

    // حساب الإزاحة بدقة
    setDragOffset({ x: clientX - position.x, y: clientY - position.y });

    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;

    const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));

    // السحب يتم فقط إذا تحرك الإصبع مسافة (أكبر من 25 بكسل)
    if (dist > 25 && !isActuallyDragging) {
      setIsActuallyDragging(true);
      // في الهاتف، السحب يفتح القائمة فوراً لاختيار سريع (AnyDesk style)
      if (isTouchDevice.current) setIsHovered(true);
    }

    if (isActuallyDragging && !isLocked) {
      const nx = Math.max(btnVisualSize/2, Math.min(window.innerWidth - btnVisualSize/2, clientX - dragOffset.x));
      const ny = Math.max(btnVisualSize/2, Math.min(window.innerHeight - btnVisualSize/2, clientY - dragOffset.y));
      setPosition({ x: nx, y: ny });
    }

    if (isHovered) {
      updateActiveItemFromPoint(clientX, clientY);
    }
  }, [isDragging, isActuallyDragging, dragOffset, isLocked, isHovered]);

  const stopDrag = useCallback((clientX: number, clientY: number, isTouch: boolean) => {
    if (!isDragging) return;

    const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));

    // أي لمسة بحركة أقل من 25 بكسل تعتبر نقرة لفتح/إغلاق القائمة
    if (dist < 25) {
      setIsHovered(prev => !prev);
      setHoveredCategory(null);
      setActiveLinkId(null);
    }
    // اختيار الرابط عند السحب والإفلات (اختياري)
    else if (isHovered && isActuallyDragging) {
      const elements = document.elementsFromPoint(clientX, clientY);
      let url = null;
      for (const el of elements) {
        const u = el.getAttribute('data-url');
        if (u) { url = u; break; }
      }
      if (url) {
        window.open(url, "_blank");
        setIsHovered(false);
      }
    }

    setIsDragging(false);
    setIsActuallyDragging(false);
    localStorage.setItem("kse_admin_floating_pos", JSON.stringify(position));
  }, [isDragging, isActuallyDragging, position, isHovered]);

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

  const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const totalAngle = 260;
  const startAngle = isLeft ? 50 : 250;
  const count = categories.length;
  const step = count > 0 ? totalAngle / count : 0;

  return (
    <>
      {/* Premium Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] transition-all duration-500 ${
          isHovered ? "bg-black/60 backdrop-blur-[6px] opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => {
          setIsHovered(false);
          setHoveredCategory(null);
        }}
      />
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          left: 0, top: 0,
          willChange: "transform",
          transition: isDragging ? "none" : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)"
        }}
      >
        {/* Container لمنطقة اللمس - متمركزة بدقة */}
        <div
          className="absolute pointer-events-auto flex items-center justify-center"
          style={{
            width: hitAreaSize, height: hitAreaSize,
            left: -hitAreaSize/2, top: -hitAreaSize/2,
            touchAction: "none"
          }}
          onMouseDown={(e) => { e.stopPropagation(); startDrag(e.clientX, e.clientY, false); }}
          onTouchStart={(e) => { e.stopPropagation(); startDrag(e.touches[0].clientX, e.touches[0].clientY, true); }}
          onMouseEnter={() => !isTouchDevice.current && setIsHovered(true)}
          onMouseLeave={() => {
              if (!isTouchDevice.current) {
                  hoverTimeout.current = setTimeout(() => {
                      setIsHovered(false);
                      setHoveredCategory(null);
                  }, 400);
              }
          }}
        >
          {/* Radial Menu - يتبع الزر بدقة */}
          <div
            className={`absolute transition-all duration-300 transform-gpu ${
              isHovered ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-50 pointer-events-none"
            }`}
            style={{
              width: 450, height: 450,
              left: '50%', top: '50%',
              transform: `translate(-50%, -50%) scale(${menuScale})`,
              zIndex: 10
            }}
          >
            <svg width="450" height="450" viewBox="-225 -225 450 450" className="overflow-visible drop-shadow-2xl">
              {categories.map((cat, i) => {
                const sA = startAngle + (i * step) + 2;
                const eA = sA + step - 4;
                const midA = (sA + eA) / 2;
                const midRad = (midA - 90) * Math.PI / 180;
                const tx = Math.cos(midRad) * ((innerRadius + outerRadius) / 2);
                const ty = Math.sin(midRad) * ((innerRadius + outerRadius) / 2);

                return (
                  <g key={cat.id} data-category-id={cat.id} className="cursor-pointer group">
                    <path
                      d={getArcPath(sA, eA, innerRadius, outerRadius)}
                      fill={cat.color}
                      stroke="rgba(0,0,0,0.2)"
                      strokeWidth="1"
                      className="transition-all duration-300 hover:brightness-110"
                      data-category-id={cat.id}
                      onMouseEnter={() => !isTouchDevice.current && setHoveredCategory(cat.id)}
                    />
                    <text x={tx} y={ty} textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none select-none">
                       <tspan x={tx} dy="0" fontSize="11" fill="white" fontWeight="900" className="uppercase drop-shadow-md">{cat.icon} {cat.name.substring(0,8)}</tspan>
                    </text>

                    {hoveredCategory === cat.id && (
                      <g className="animate-in fade-in zoom-in duration-200">
                        {cat.links.map((link, li) => {
                          const linkStep = 32;
                          const totalSubAngle = (cat.links.length - 1) * linkStep;
                          const subStartAngle = midA - (totalSubAngle / 2);
                          const lsA = subStartAngle + (li * linkStep);
                          const leA = lsA + linkStep - 4;
                          const lmidRad = ((lsA + leA) / 2 - 90) * Math.PI / 180;
                          const ltx = Math.cos(lmidRad) * ((outerRadius + subRingRadius) / 2);
                          const lty = Math.sin(lmidRad) * ((outerRadius + subRingRadius) / 2);
                          const isActive = activeLinkId === link.id;

                          return (
                            <g key={link.id} data-link-id={link.id} data-url={link.url} className="cursor-pointer">
                              <path
                                d={getArcPath(lsA, leA, outerRadius + 6, subRingRadius)}
                                fill={isActive ? "#fff" : COLORS[li % COLORS.length]}
                                stroke={isActive ? "#fff" : "white"}
                                strokeWidth={isActive ? "3" : "1"}
                                data-link-id={link.id}
                                data-url={link.url}
                                className="transition-all duration-200"
                                style={{
                                  filter: isActive ? "drop-shadow(0 0 8px rgba(255,255,255,0.8))" : "none"
                                }}
                              />
                              <text x={ltx} y={lty} fill={isActive ? "#000" : "white"} fontSize="9" fontWeight="900" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none uppercase">
                                {link.name.substring(0,12)}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* زر الواجهة - متمركز تماماً في منطقة اللمس */}
          <div
            className={`flex h-14 w-14 items-center justify-center shadow-2xl transition-all duration-500 relative z-[100] ${
                isActuallyDragging ? "scale-90 opacity-80 shadow-inner" : "scale-100"
            } ${isHovered ? "bg-[#00f3ff] rotate-45 rounded-full border-2 border-white shadow-[0_0_20px_rgba(0,243,255,0.5)]" : "bg-white rounded-2xl rotate-0"}`}
          >
             {isHovered ? (
                <span className="text-2xl font-black text-black -rotate-45 select-none">✕</span>
             ) : (
                <div className="grid grid-cols-2 gap-1.5 p-1">
                    <div className="w-2.5 h-2.5 bg-slate-800 rounded-sm" />
                    <div className="w-2.5 h-2.5 bg-slate-800 rounded-sm" />
                    <div className="w-2.5 h-2.5 bg-slate-800 rounded-sm" />
                    <div className="w-2.5 h-2.5 bg-slate-800 rounded-sm" />
                </div>
             )}
          </div>
        </div>
      </div>
    </>
  );
}

function getArcPath(startAngle: number, endAngle: number, ir: number, or: number) {
    const startRad = ((startAngle - 90) * Math.PI) / 180.0;
    const endRad = ((endAngle - 90) * Math.PI) / 180.0;
    const x1 = Math.cos(startRad) * or; const y1 = Math.sin(startRad) * or;
    const x2 = Math.cos(endRad) * or;   const y2 = Math.sin(endRad) * or;
    const x3 = Math.cos(endRad) * ir;   const y3 = Math.sin(endRad) * ir;
    const x4 = Math.cos(startRad) * ir; const y4 = Math.sin(startRad) * ir;
    const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x1} ${y1} A ${or} ${or} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}
