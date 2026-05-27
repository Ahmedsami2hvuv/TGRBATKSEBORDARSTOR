"use client";

import React, { useState, useEffect, useCallback } from "react";

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  color: string;
  label: string;
  subItems?: MenuItem[];
  url?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "display", icon: "🖥️", color: "#3291b6", label: "Display" },
  { id: "exit", icon: "🚪", color: "#3291b6", label: "Exit" },
  { id: "chat", icon: "💬", color: "#3291b6", label: "Chat" },
  { id: "actions", icon: "⚡", color: "#3291b6", label: "Actions" },
  {
    id: "input",
    icon: "⌨️",
    color: "#f39c12",
    label: "Input",
    subItems: [
      { id: "f1", icon: <span className="text-[10px] font-bold">F1</span>, color: "#3291b6", label: "F1" },
      { id: "kb_arrow", icon: "⌨️➡️", color: "#3291b6", label: "KB Arrow" },
      { id: "kb_mouse", icon: "⌨️🖱️", color: "#3291b6", label: "KB Mouse" },
    ]
  },
  { id: "close", icon: "✕", color: "#e74c3c", label: "Close" },
  { id: "touch", icon: "👆", color: "#95a5a6", label: "Touch" },
  { id: "window", icon: "🔳", color: "#27ae60", label: "Window" },
];

export function FloatingAdminMenu() {
  const [position, setPosition] = useState({ x: 40, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  // Constants for AnyDesk dimensions
  const innerRadius = 50;
  const middleRadius = 140;
  const outerRadius = 230;

  // Load position
  useEffect(() => {
    const savedPos = localStorage.getItem("kse_admin_floating_pos");
    if (savedPos) {
      try { setPosition(JSON.parse(savedPos)); } catch {}
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isOpen) return;
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
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;

    const x1 = Math.cos(startRad) * or;
    const y1 = Math.sin(startRad) * or;
    const x2 = Math.cos(endRad) * or;
    const y2 = Math.sin(endRad) * or;
    const x3 = Math.cos(endRad) * ir;
    const y3 = Math.sin(endRad) * ir;
    const x4 = Math.cos(startRad) * ir;
    const y4 = Math.sin(startRad) * ir;

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      `M ${x1} ${y1}`,
      `A ${or} ${or} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${ir} ${ir} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
      "Z"
    ].join(" ");
  };

  const isLeft = position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const totalAngle = 260; // Approximate angle coverage from the image
  const startAngleOffset = isLeft ? 50 : 230;
  const angleStep = totalAngle / MENU_ITEMS.length;

  return (
    <div
      className="fixed z-[9999] touch-none select-none flex items-center justify-center"
      style={{ left: position.x, top: position.y }}
    >
      {/* Radial Menu SVG Container */}
      <div
        className={`absolute transition-all duration-300 ease-out origin-center ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
        style={{ transform: `translate(-50%, -50%) ${isOpen ? 'scale(1)' : 'scale(0.5)'}` }}
      >
        <svg width="600" height="600" viewBox="-300 -300 600 600" className="overflow-visible">
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
              <feOffset dx="0" dy="0" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {MENU_ITEMS.map((item, index) => {
            const startAngle = startAngleOffset + (index * angleStep);
            const endAngle = startAngle + angleStep;
            const midAngle = (startAngle + endAngle) / 2;
            const textRadius = (innerRadius + middleRadius) / 2;
            const tx = Math.cos((midAngle - 90) * Math.PI / 180) * textRadius;
            const ty = Math.sin((midAngle - 90) * Math.PI / 180) * textRadius;

            return (
              <g
                key={item.id}
                className="cursor-pointer group"
                onMouseEnter={() => setActiveItem(item.id)}
              >
                <path
                  d={getArcPath(startAngle, endAngle, innerRadius, middleRadius)}
                  fill={item.color}
                  stroke="#1a1a1a"
                  strokeWidth="2"
                  className="transition-colors duration-200 group-hover:brightness-110"
                />
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fill="white"
                  fontSize="24"
                  className="pointer-events-none"
                >
                  {item.icon}
                </text>

                {/* Sub-menu outer segments */}
                {activeItem === item.id && item.subItems && (
                  <g className="animate-in fade-in zoom-in duration-200">
                    {item.subItems.map((sub, sIdx) => {
                      const sAngleStep = angleStep / item.subItems!.length;
                      const sStartAngle = startAngle + (sIdx * sAngleStep);
                      const sEndAngle = sStartAngle + sAngleStep;
                      const sMidAngle = (sStartAngle + sEndAngle) / 2;
                      const sTextRadius = (middleRadius + outerRadius) / 2;
                      const stx = Math.cos((sMidAngle - 90) * Math.PI / 180) * sTextRadius;
                      const sty = Math.sin((sMidAngle - 90) * Math.PI / 180) * sTextRadius;

                      return (
                        <g key={sub.id} className="hover:brightness-125 transition-all">
                          <path
                            d={getArcPath(sStartAngle, sEndAngle, middleRadius + 2, outerRadius)}
                            fill={sub.color}
                            stroke="#1a1a1a"
                            strokeWidth="2"
                          />
                          <foreignObject
                            x={stx - 15} y={sty - 15} width="30" height="30"
                            className="pointer-events-none"
                          >
                            <div className="flex items-center justify-center w-full h-full text-white text-xl">
                              {sub.icon}
                            </div>
                          </foreignObject>
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

      {/* Center Diamond Button (AnyDesk Logo Style) */}
      <div
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsOpen(true)}
        className={`relative z-50 flex h-16 w-16 items-center justify-center shadow-2xl transition-all duration-300 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        } ${isOpen ? "scale-90" : "scale-100"}`}
        onMouseLeave={() => {
          // Optional: close on leave, but AnyDesk usually stays for a bit or requires click?
          // Let's keep it open for now to allow sub-menu selection.
        }}
      >
        <div
          className={`absolute inset-0 bg-white rotate-45 transition-all duration-300 ${isOpen ? 'rounded-lg bg-cyan-400' : 'rounded-xl'}`}
        />
        <div className="relative z-10 flex flex-col items-center justify-center gap-1 transition-transform duration-300">
          {isOpen ? (
            <span className="text-2xl font-bold text-white">✕</span>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="w-5 h-5 bg-slate-800 rotate-45" />
              <div className="w-5 h-5 bg-slate-800 rotate-45" />
            </div>
          )}
        </div>
      </div>

      {/* Click away listener */}
      {isOpen && (
        <div
          className="fixed inset-0 -z-10"
          onMouseEnter={() => {}} // dummy to prevent closing when moving to menu
          onClick={() => {
            setIsOpen(false);
            setActiveItem(null);
          }}
        />
      )}
    </div>
  );
}
