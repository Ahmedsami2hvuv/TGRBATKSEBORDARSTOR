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
  const [position, setPosition] = useState({ x: 50, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [menuScale, setMenuScale] = useState(1);
  const [menuFontSize, setMenuFontSize] = useState(8);
  const [isActuallyDragging, setIsActuallyDragging] = useState(false);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  const btnSize = 56;
  const innerRadius = 28;
  const outerRadius = 80;
  const subRingRadius = 135;

  // تحميل البيانات
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
      const savedFontSize = localStorage.getItem("kse_admin_floating_fontsize");
      if (savedFontSize) setMenuFontSize(parseInt(savedFontSize));
    };
    loadSaved();
    window.addEventListener("storage", loadSaved);
    fetch("/api/abo1stor3hlaa2kbr8-47/settings/floating-menu")
      .then(res => res.json())
      .then(data => {
        if (data.categories) setCategories(data.categories);
        if (data.isLocked !== undefined) setIsLocked(data.isLocked);
        if (data.menuScale !== undefined) setMenuScale(data.menuScale);
        if (data.menuFontSize !== undefined) setMenuFontSize(data.menuFontSize);
      }).catch(() => {});
    return () => window.removeEventListener("storage", loadSaved);
  }, []);

  // بدء السحب
  const onStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setIsActuallyDragging(false);
    dragStartPos.current = { x: clientX, y: clientY };
    setDragOffset({ x: clientX - position.x, y: clientY - position.y });
  };

  // أثناء الحركة
  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));
    if (dist > 10) setIsActuallyDragging(true);

    if (isActuallyDragging && !isLocked) {
      const nx = Math.max(btnSize/2, Math.min(window.innerWidth - btnSize/2, clientX - dragOffset.x));
      const ny = Math.max(btnSize/2, Math.min(window.innerHeight - btnSize/2, clientY - dragOffset.y));
      setPosition({ x: nx, y: ny });
    }
  }, [isDragging, isActuallyDragging, dragOffset, isLocked]);

  // عند الإفلات (القرار النهائي: نقرة أم سحب)
  const onEnd = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));

    // إذا لم يتحرك الإصبع كثيراً، فهي نقرة
    if (dist < 15) {
      const elements = document.elementsFromPoint(clientX, clientY);
      let url = null;
      let catId = null;
      for (const el of elements) {
        if (el.getAttribute('data-url')) url = el.getAttribute('data-url');
        if (el.getAttribute('data-category-id')) catId = el.getAttribute('data-category-id');
      }

      if (isHovered) {
        if (url) {
          window.open(url, "_blank");
          setIsHovered(false);
        } else if (catId) {
          setHoveredCategory(catId);
        } else {
          setIsHovered(false); // إغلاق عند النقر في أي مكان آخر داخل القائمة
        }
      } else {
        setIsHovered(true); // فتح القائمة بنقرة بسيطة
      }
    }

    setIsDragging(false);
    setIsActuallyDragging(false);
    if (dist > 10) localStorage.setItem("kse_admin_floating_pos", JSON.stringify(position));
  }, [isDragging, isHovered, position]);

  useEffect(() => {
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const mu = (e: MouseEvent) => onEnd(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => {
      if (isDragging) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
        if (e.cancelable) e.preventDefault();
      }
    };
    const tu = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

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
  }, [isDragging, onMove, onEnd]);

  const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const totalAngle = 260;
  const startAngle = isLeft ? 50 : 250;
  const count = categories.length;
  const step = count > 0 ? totalAngle / count : 0;

  return (
    <>
      {/* خلفية تظهر فقط عند فتح القائمة */}
      {isHovered && (
        <div
          className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity pointer-events-auto"
          onClick={() => setIsHovered(false)}
        />
      )}

      <div
        className="fixed z-[9999]"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          left: 0, top: 0,
          pointerEvents: "none"
        }}
      >
        {/* منطقة التفاعل - محدودة بحجم الزر فقط عند الإغلاق لعدم حجب الشاشة */}
        <div
          className="absolute pointer-events-auto flex items-center justify-center"
          style={{
            width: isHovered ? 400 : 70,
            height: isHovered ? 400 : 70,
            left: isHovered ? -200 : -35,
            top: isHovered ? -200 : -35,
            touchAction: "none"
          }}
          onMouseDown={(e) => onStart(e.clientX, e.clientY)}
          onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
        >
          {/* القائمة الدائرية */}
          <div
            className={`absolute transition-all duration-300 transform-gpu ${
              isHovered ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"
            }`}
            style={{ transform: `scale(${menuScale})`, zIndex: 10 }}
          >
            <svg width="400" height="400" viewBox="-200 -200 400 400" className="overflow-visible drop-shadow-2xl">
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
                      className="transition-all duration-200 hover:brightness-110"
                      data-category-id={cat.id}
                    />
                    <text x={tx} y={ty} fill="white" fontSize={menuFontSize} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none">
                       {cat.icon ? cat.icon + " " : ""}{cat.name.substring(0, 10)}
                    </text>

                    {hoveredCategory === cat.id && cat.links.map((link, li) => {
                        const lStep = 30;
                        const lStart = midA - ((cat.links.length - 1) * lStep / 2);
                        const la = lStart + (li * lStep);
                        const lRad = (la - 90) * Math.PI / 180;
                        const ltx = Math.cos(lRad) * ((outerRadius + subRingRadius) / 2);
                        const lty = Math.sin(lRad) * ((outerRadius + subRingRadius) / 2);
                        return (
                          <g key={link.id} data-url={link.url} className="cursor-pointer">
                            <path
                              d={getArcPath(la - 14, la + 14, outerRadius + 5, subRingRadius)}
                              fill={COLORS[li % COLORS.length]}
                              stroke="white"
                              strokeWidth="1"
                              data-url={link.url}
                            />
                            <text x={ltx} y={lty} fill="white" fontSize={Math.max(6, menuFontSize - 1)} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle" className="pointer-events-none uppercase">
                              {link.name.substring(0,8)}
                            </text>
                          </g>
                        );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* الزر الرئيسي - يفتح بنقرة واحدة */}
          <div
            className={`flex h-14 w-14 items-center justify-center shadow-xl transition-all duration-300 relative z-[100] ${
                isHovered ? "bg-cyan-400 rotate-45 rounded-full scale-110 shadow-cyan-500/50" : "bg-white rounded-2xl rotate-0 scale-100"
            }`}
          >
             {isHovered ? (
                <span className="text-xl font-bold text-white -rotate-45">✕</span>
             ) : (
                <div className="grid grid-cols-2 gap-1">
                    <div className="w-2 h-2 bg-slate-700 rounded-sm" />
                    <div className="w-2 h-2 bg-slate-700 rounded-sm" />
                    <div className="w-2 h-2 bg-slate-700 rounded-sm" />
                    <div className="w-2 h-2 bg-slate-700 rounded-sm" />
                </div>
             )}
          </div>
        </div>
      </div>
    </>
  );
}

function getArcPath(sA: number, eA: number, ir: number, or: number) {
  const sR = ((sA - 90) * Math.PI) / 180;
  const eR = ((eA - 90) * Math.PI) / 180;
  const x1 = Math.cos(sR) * or; const y1 = Math.sin(sR) * or;
  const x2 = Math.cos(eR) * or; const y2 = Math.sin(eR) * or;
  const x3 = Math.cos(eR) * ir; const y3 = Math.sin(eR) * ir;
  const x4 = Math.cos(sR) * ir; const y4 = Math.sin(sR) * ir;
  const arc = eA - sA <= 180 ? "0" : "1";
  return `M ${x1} ${y1} A ${or} ${or} 0 ${arc} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${arc} 0 ${x4} ${y4} Z`;
}
