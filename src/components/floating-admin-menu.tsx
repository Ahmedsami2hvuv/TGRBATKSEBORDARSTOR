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
  const positionRef = useRef({ x: 50, y: 300 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isActuallyDraggingRef = useRef(false);
  const isLockedRef = useRef(false);
  const mainButtonRef = useRef<HTMLDivElement>(null);

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  const btnSize = 56;
  const innerRadius = 28;
  const outerRadius = 80;
  const subRingRadius = 135;

  // keep isLockedRef in sync
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  // تحميل البيانات
  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadSaved = () => {
      const savedData = localStorage.getItem("kse_admin_floating_data");
      if (savedData) try { setCategories(JSON.parse(savedData)); } catch(e){}
      const savedPos = localStorage.getItem("kse_admin_floating_pos");
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number" && !isNaN(parsed.x) && !isNaN(parsed.y)) {
            const { width, height } = getViewportDims();
            const x = Math.max(15, Math.min(width - 15, parsed.x));
            const y = Math.max(15, Math.min(height - 15, parsed.y));
            setPosition({ x, y });
            positionRef.current = { x, y };
          } else {
            setPosition({ x: 50, y: 300 });
            positionRef.current = { x: 50, y: 300 };
          }
        } catch(e) {
          setPosition({ x: 50, y: 300 });
          positionRef.current = { x: 50, y: 300 };
        }
      } else {
        setPosition({ x: 50, y: 300 });
        positionRef.current = { x: 50, y: 300 };
      }
      const savedLocked = localStorage.getItem("kse_admin_floating_locked");
      if (savedLocked) {
        const locked = savedLocked === "true";
        setIsLocked(locked);
        isLockedRef.current = locked;
      }
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
        if (data.isLocked !== undefined) {
          setIsLocked(data.isLocked);
          isLockedRef.current = data.isLocked;
        }
        if (data.menuScale !== undefined) setMenuScale(data.menuScale);
        if (data.menuFontSize !== undefined) setMenuFontSize(data.menuFontSize);
      }).catch(() => {});
    return () => window.removeEventListener("storage", loadSaved);
  }, []);

  // بدء السحب
  const onStart = useCallback((clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    isActuallyDraggingRef.current = false;
    dragStartPos.current = { x: clientX, y: clientY };
    dragOffsetRef.current = { x: clientX - positionRef.current.x, y: clientY - positionRef.current.y };
    
    setIsDragging(true);
    setIsActuallyDragging(false);
    setDragOffset({ x: clientX - positionRef.current.x, y: clientY - positionRef.current.y });
  }, []);

  // تسجيل أحداث اللمس مباشرة على الزر لمنع السحب للتحديث الافتراضي (pull-to-refresh) بالهواتف
  useEffect(() => {
    const btn = mainButtonRef.current;
    if (!btn) return;

    const ts = (e: TouchEvent) => {
      e.stopPropagation(); // منع انتشار الحدث لكي لا يتفعل الـ pull-to-refresh
      onStart(e.touches[0].clientX, e.touches[0].clientY);
      if (e.cancelable) e.preventDefault();
    };

    const tm = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
        if (e.cancelable) e.preventDefault();
        e.stopPropagation(); // منع انتشار الحركة للأعلى لمنع أي رفرش
      }
    };

    const te = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        e.stopPropagation();
      }
    };

    btn.addEventListener("touchstart", ts, { passive: false });
    btn.addEventListener("touchmove", tm, { passive: false });
    btn.addEventListener("touchend", te, { passive: true });

    return () => {
      btn.removeEventListener("touchstart", ts);
      btn.removeEventListener("touchmove", tm);
      btn.removeEventListener("touchend", te);
    };
  }, [onStart, onMove, onEnd]);

  // أثناء الحركة
  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));
    if (dist > 10 && !isActuallyDraggingRef.current) {
      isActuallyDraggingRef.current = true;
      setIsActuallyDragging(true);
    }

    if (isActuallyDraggingRef.current && !isLockedRef.current) {
      const { width, height } = getViewportDims();
      
      // السماح للزر بالخروج جزئياً (حتى يتبقى 15 بكسل منه فقط على الحواف) ليعطي حرية حركة كاملة في الهاتف
      const minX = 15;
      const maxX = width - 15;
      const minY = 15;
      const maxY = height - 15;

      const nx = Math.max(minX, Math.min(maxX, clientX - dragOffsetRef.current.x));
      const ny = Math.max(minY, Math.min(maxY, clientY - dragOffsetRef.current.y));
      const newPos = { x: nx, y: ny };
      positionRef.current = newPos;
      setPosition(newPos);
    }
  }, []);

  // عند الإفلات (القرار النهائي: نقرة أم سحب)
  const onEnd = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
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

    isDraggingRef.current = false;
    isActuallyDraggingRef.current = false;
    setIsDragging(false);
    setIsActuallyDragging(false);
    if (dist > 10) localStorage.setItem("kse_admin_floating_pos", JSON.stringify(positionRef.current));
  }, [isHovered]);

  useEffect(() => {
    const mm = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        onMove(e.clientX, e.clientY);
      }
    };
    const mu = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        onEnd(e.clientX, e.clientY);
      }
    };

    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);

    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, [onMove, onEnd]);

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
          ref={mainButtonRef}
          className="absolute pointer-events-auto flex items-center justify-center"
          style={{
            width: isHovered ? 400 : 70,
            height: isHovered ? 400 : 70,
            left: isHovered ? -200 : -35,
            top: isHovered ? -200 : -35,
            touchAction: "none"
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStart(e.clientX, e.clientY);
          }}
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

function getViewportDims() {
  if (typeof window === "undefined") return { width: 500, height: 800 };
  const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  return { width, height };
}
