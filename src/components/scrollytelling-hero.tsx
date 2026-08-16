"use client";

// ⚠️ قبل الاستخدام: لازم تحمّل خط "Lalezar" بملف layout.tsx مالت الموقع، مثلاً:
// import { Lalezar } from "next/font/google";
// const lalezar = Lalezar({ subsets: ["arabic"], weight: "400", variable: "--font-lalezar" });
// وحطه على <html className={lalezar.variable}>
// أو أبسط: ضيف بـ layout.tsx جوه <head>:
// <link href="https://fonts.googleapis.com/css2?family=Lalezar&display=swap" rel="stylesheet" />

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, MotionValue } from "framer-motion";

// ============================================================
// "مسار التوصيل" — الطريق يترسم لحاله وانت تسكرول، ويعدي
// على محطات (صيدلية / مطعم / سوبرماركت / هدايا) وصولاً لبابك
// ============================================================

const SPRING = { stiffness: 90, damping: 24, mass: 0.6 };

// نقاط منحنى الطريق (نظام إحداثيات 0-400 أفقي × 0-900 عمودي)
const ROUTE_PATH =
  "M 200,40 C 350,140 50,220 200,320 C 350,420 50,500 200,600 C 320,680 90,760 200,860";

type Stop = { frac: number; emoji: string; label: string; glow: string };

const STOPS: Stop[] = [
  { frac: 0.03, emoji: "📦", label: "طلبك اترسل", glow: "rgba(241,228,201,0.6)" },
  { frac: 0.27, emoji: "💊", label: "صيدلية", glow: "rgba(46,196,182,0.6)" },
  { frac: 0.46, emoji: "🍽️", label: "مطعم", glow: "rgba(244,185,66,0.6)" },
  { frac: 0.66, emoji: "🛒", label: "سوبرماركت", glow: "rgba(193,68,14,0.6)" },
  { frac: 0.81, emoji: "🎁", label: "هدايا", glow: "rgba(244,185,66,0.6)" },
  { frac: 0.97, emoji: "🏠", label: "بابك", glow: "rgba(241,228,201,0.75)" },
];

const TRACKER_STAGES = [
  { label: "الطلب", from: 0, to: 0.3 },
  { label: "بالمتجر", from: 0.3, to: 0.65 },
  { label: "بالطريق إلك", from: 0.65, to: 1.01 },
];

export default function ScrollytellingHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

  const { scrollYProgress: rawProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(rawProgress, SPRING);

  const containerOpacity = useTransform(rawProgress, [0.97, 1], [1, 0]);
  const dashOffset = useTransform(progress, (p) => pathLength * (1 - p));
  const hintOpacity = useTransform(rawProgress, [0, 0.05], [1, 0]);

  // العناوين الثلاثة
  const h1Opacity = useTransform(progress, [0, 0.06, 0.22, 0.27], [0, 1, 1, 0]);
  const h1Y = useTransform(progress, [0, 0.1], [16, 0]);
  const h2Opacity = useTransform(progress, [0.3, 0.36, 0.6, 0.66], [0, 1, 1, 0]);
  const h2Y = useTransform(progress, [0.3, 0.4], [16, 0]);
  const h3Opacity = useTransform(progress, [0.68, 0.74, 1], [0, 1, 1]);
  const h3Y = useTransform(progress, [0.68, 0.78], [16, 0]);

  return (
    <div ref={containerRef} className="h-[420vh] relative w-full" style={{ background: "#150F35" }}>
      <motion.div
        style={{ opacity: containerOpacity }}
        className="sticky top-0 h-screen overflow-hidden flex items-center justify-center w-full"
        dir="rtl"
      >
        <Background />

        <SidePathMap progress={progress} pathRef={pathRef} dashOffset={dashOffset} pathLength={pathLength} />

        {/* العنوان ١ */}
        <motion.div style={{ opacity: h1Opacity, y: h1Y }} className="absolute top-[13%] w-[90vw] max-w-2xl text-center px-4 z-20">
          <Headline>
            شنو اللي <span style={{ color: "#F4B942" }}>تحتاجه</span> اليوم؟
          </Headline>
        </motion.div>

        {/* العنوان ٢ */}
        <motion.div style={{ opacity: h2Opacity, y: h2Y }} className="absolute top-1/2 -translate-y-1/2 w-[90vw] max-w-2xl text-center px-4 z-20">
          <Headline>
            صيدلية، مطعم، أسواق،
            <br />
            أو أي شيء <span style={{ color: "#F4B942" }}>ببالك</span>...
          </Headline>
        </motion.div>

        {/* العنوان ٣ */}
        <motion.div style={{ opacity: h3Opacity, y: h3Y }} className="absolute bottom-[15%] w-[92vw] max-w-2xl text-center px-4 z-20">
          <Headline>
            أبو الأكبر <span style={{ color: "#F4B942" }}>للتوصيل الشامل</span>
          </Headline>
          <p className="mt-3 text-base md:text-xl font-medium" style={{ color: "#F1E4C9" }}>
            ومو بس هيج... فتحنالك متجر إلكتروني بيه كلشي!
          </p>
        </motion.div>

        <Tracker progress={progress} />

        {/* دعوة للسكرول */}
        <motion.div style={{ opacity: hintOpacity }} className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30">
          <span className="text-xs font-bold tracking-[3px]" style={{ color: "#F4B942" }}>
            اسحب للأسفل
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-8 h-8 rounded-full flex items-center justify-center font-black"
            style={{ background: "#F4B942", color: "#150F35" }}
          >
            ↓
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="leading-tight"
      style={{
        fontFamily: "'Lalezar', sans-serif",
        fontWeight: 400,
        fontSize: "clamp(28px, 6vw, 52px)",
        color: "#FDF8F0",
        textShadow: "0 0 30px rgba(244,185,66,0.35)",
      }}
    >
      {children}
    </h2>
  );
}

function Background() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(244,185,66,0.10), transparent 55%), radial-gradient(ellipse at 75% 75%, rgba(193,68,14,0.14), transparent 55%), linear-gradient(180deg, #150F35 0%, #241a55 55%, #0e0a28 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 20% 30%, #fff 100%, transparent), radial-gradient(1.5px 1.5px at 70% 15%, #fff 100%, transparent), radial-gradient(1px 1px at 85% 45%, #fff 100%, transparent), radial-gradient(1.5px 1.5px at 40% 65%, #fff 100%, transparent), radial-gradient(1px 1px at 60% 85%, #fff 100%, transparent), radial-gradient(1.5px 1.5px at 10% 80%, #fff 100%, transparent)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-32 z-[5]" style={{ background: "linear-gradient(180deg, #150F35, transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 h-32 z-[5]" style={{ background: "linear-gradient(0deg, #150F35, transparent)" }} />
    </>
  );
}

function SidePathMap({
  progress,
  pathRef,
  dashOffset,
  pathLength,
}: {
  progress: MotionValue<number>;
  pathRef: React.RefObject<SVGPathElement>;
  dashOffset: MotionValue<number>;
  pathLength: number;
}) {
  return (
    <div className="relative z-10" style={{ width: "min(92vw, 480px)", height: "88vh" }}>
      <svg viewBox="0 0 400 900" preserveAspectRatio="xMidYMid meet" className="w-full h-full overflow-visible">
        <motion.path
          ref={pathRef}
          d={ROUTE_PATH}
          fill="none"
          stroke="#F1E4C9"
          strokeWidth={3.4}
          strokeLinecap="round"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: dashOffset,
            filter: "drop-shadow(0 0 6px rgba(241,228,201,0.55))",
          }}
        />
      </svg>

      {STOPS.map((s, i) => (
        <StopPin key={i} stop={s} progress={progress} pathRef={pathRef} />
      ))}

      <Bike progress={progress} pathRef={pathRef} pathLength={pathLength} />
    </div>
  );
}

function StopPin({
  stop,
  progress,
  pathRef,
}: {
  stop: Stop;
  progress: MotionValue<number>;
  pathRef: React.RefObject<SVGPathElement>;
}) {
  const [pos, setPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    const pt = p.getPointAtLength(stop.frac * len);
    setPos({ x: (pt.x / 400) * 100, y: (pt.y / 900) * 100 });
  }, [pathRef, stop.frac]);

  const opacity = useTransform(progress, [stop.frac - 0.015, stop.frac], [0, 1]);
  const scale = useTransform(progress, [stop.frac - 0.015, stop.frac], [0.4, 1]);

  return (
    <motion.div
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, opacity, scale }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-[3]"
    >
      <div
        className="rounded-full flex items-center justify-center backdrop-blur-md border"
        style={{
          width: stop.emoji === "🏠" ? 64 : 52,
          height: stop.emoji === "🏠" ? 64 : 52,
          fontSize: stop.emoji === "🏠" ? 28 : 24,
          background: "rgba(255,255,255,0.06)",
          borderColor: stop.glow,
          borderWidth: 1.5,
          boxShadow: `0 0 22px ${stop.glow}`,
        }}
      >
        {stop.emoji}
      </div>
      <span className="text-xs font-bold whitespace-nowrap" style={{ color: "#F1E4C9" }}>
        {stop.label}
      </span>
    </motion.div>
  );
}

function Bike({
  progress,
  pathRef,
  pathLength,
}: {
  progress: MotionValue<number>;
  pathRef: React.RefObject<SVGPathElement>;
  pathLength: number;
}) {
  const [pos, setPos] = useState({ x: 50, y: 8 });

  useEffect(() => {
    return progress.on("change", (p) => {
      const path = pathRef.current;
      if (!path || !pathLength) return;
      const pt = path.getPointAtLength(Math.min(p, 1) * pathLength);
      setPos({ x: (pt.x / 400) * 100, y: (pt.y / 900) * 100 });
    });
  }, [progress, pathRef, pathLength]);

  const opacity = useTransform(progress, [0.48, 0.55], [0, 1]);

  return (
    <motion.div
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, opacity }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-[4] flex items-center justify-center text-3xl"
    >
      <div style={{ filter: "drop-shadow(0 0 14px rgba(244,185,66,0.8))" }}>🛵</div>
    </motion.div>
  );
}

function Tracker({ progress }: { progress: MotionValue<number> }) {
  return (
    <div className="hidden md:flex flex-col gap-6 absolute left-6 top-1/2 -translate-y-1/2 z-30">
      {TRACKER_STAGES.map((stage, i) => (
        <TrackerItem key={i} stage={stage} progress={progress} />
      ))}
    </div>
  );
}

function TrackerItem({
  stage,
  progress,
}: {
  stage: { label: string; from: number; to: number };
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, (p) => (p >= stage.from && p < stage.to ? 1 : 0.35));
  return (
    <motion.div style={{ opacity }} className="flex items-center gap-2.5">
      <motion.div
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: "#F4B942", boxShadow: "0 0 12px rgba(244,185,66,0.8)" }}
      />
      <span className="text-xs font-bold" style={{ color: "#F1E4C9" }}>
        {stage.label}
      </span>
    </motion.div>
  );
}
