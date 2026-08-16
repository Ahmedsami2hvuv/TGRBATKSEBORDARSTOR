"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring, MotionValue } from "framer-motion";
import { Package, Pill, ShoppingBag, Shirt, Gift, Bike, ChevronDown, Sparkles } from "lucide-react";

// إعداد الـ spring لتنعيم كل حركة مرتبطة بالسكرول
const SPRING = { stiffness: 90, damping: 22, mass: 0.6 };

function useSmooth(mv: MotionValue<number>) {
  return useSpring(mv, SPRING);
}

export default function ScrollytellingHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: rawProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const scrollYProgress = useSmooth(rawProgress);

  // ============ خلفية متحركة عامة ============
  const bgGradientRotate = useTransform(rawProgress, [0, 1], [0, 60]);
  const orb1X = useTransform(scrollYProgress, [0, 0.5, 1], ["-10%", "40%", "90%"]);
  const orb2X = useTransform(scrollYProgress, [0, 0.5, 1], ["90%", "50%", "0%"]);
  const ambientOpacity = useTransform(rawProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  // ============ المشهد ١: الصندوق (0% - 30%) ============
  const boxScale = useTransform(scrollYProgress, [0, 0.14, 0.22, 0.3], [0.85, 1.08, 1.25, 0.4]);
  const boxOpacity = useTransform(scrollYProgress, [0, 0.05, 0.18, 0.26], [0, 1, 1, 0]);
  const boxY = useTransform(scrollYProgress, [0, 0.22, 0.3], [40, 0, -60]);
  const boxRotate = useTransform(scrollYProgress, [0, 0.3], [-4, 6]);
  const boxGlow = useTransform(scrollYProgress, [0, 0.15, 0.28], [0.2, 0.9, 0]);
  const text1Y = useTransform(scrollYProgress, [0, 0.15], [20, 0]);
  const text1Opacity = useTransform(scrollYProgress, [0, 0.1, 0.16, 0.24], [0, 1, 1, 0]);
  const text1Blur = useTransform(scrollYProgress, [0, 0.08, 0.22, 0.26], [8, 0, 0, 6]);

  // ============ المشهد ٢: الأيقونات المتطايرة (24% - 66%) ============
  const itemsOpacity = useTransform(scrollYProgress, [0.24, 0.32, 0.56, 0.66], [0, 1, 1, 0]);
  const itemsScale = useTransform(scrollYProgress, [0.24, 0.4, 0.56], [0.4, 1.15, 1.5]);
  const text2Y = useTransform(scrollYProgress, [0.28, 0.4], [24, 0]);
  const text2Opacity = useTransform(scrollYProgress, [0.28, 0.38, 0.56, 0.66], [0, 1, 1, 0]);

  const pillX = useTransform(scrollYProgress, [0.24, 0.56], [0, -170]);
  const pillY = useTransform(scrollYProgress, [0.24, 0.56], [0, -160]);
  const pillRotate = useTransform(scrollYProgress, [0.24, 0.6], [0, -120]);

  const bagX = useTransform(scrollYProgress, [0.24, 0.56], [0, 170]);
  const bagY = useTransform(scrollYProgress, [0.24, 0.56], [0, -110]);
  const bagRotate = useTransform(scrollYProgress, [0.24, 0.6], [0, 120]);

  const shirtX = useTransform(scrollYProgress, [0.24, 0.56], [0, -140]);
  const shirtY = useTransform(scrollYProgress, [0.24, 0.56], [0, 140]);
  const shirtRotate = useTransform(scrollYProgress, [0.24, 0.6], [0, -100]);

  const giftX = useTransform(scrollYProgress, [0.24, 0.56], [0, 140]);
  const giftY = useTransform(scrollYProgress, [0.24, 0.56], [0, 170]);
  const giftRotate = useTransform(scrollYProgress, [0.24, 0.6], [0, 100]);

  // ============ المشهد ٣: الدراجة (60% - 100%) ============
  const bikeOpacity = useTransform(scrollYProgress, [0.6, 0.68, 0.94, 1], [0, 1, 1, 0]);
  const bikeX = useTransform(scrollYProgress, [0.6, 0.82, 1], [340, 0, -340]);
  const bikeScale = useTransform(scrollYProgress, [0.6, 0.82], [0.6, 1.15]);
  const bikeGlow = useTransform(scrollYProgress, [0.6, 0.75, 0.95], [0.2, 1, 0.4]);
  const roadLineOpacity = useTransform(scrollYProgress, [0.62, 0.7, 0.9, 0.98], [0, 1, 1, 0]);
  const text3Y = useTransform(scrollYProgress, [0.66, 0.78], [26, 0]);
  const text3Opacity = useTransform(scrollYProgress, [0.66, 0.78, 0.92, 1], [0, 1, 1, 0]);

  const containerOpacity = useTransform(scrollYProgress, [0.96, 1], [1, 0]);

  // مؤشر التقدّم الجانبي
  const dot1 = useTransform(scrollYProgress, [0, 0.28], [0.35, 1]);
  const dot2 = useTransform(scrollYProgress, [0.28, 0.32, 0.6], [0.35, 1, 1]);
  const dot3 = useTransform(scrollYProgress, [0.6, 0.64, 1], [0.35, 1, 1]);
  const scrollHintOpacity = useTransform(rawProgress, [0, 0.06], [1, 0]);

  return (
    <div ref={containerRef} className="h-[420vh] relative w-full bg-slate-950">
      <motion.div
        style={{ opacity: containerOpacity }}
        className="sticky top-0 h-screen overflow-hidden flex flex-col items-center justify-center text-white w-full"
      >
        {/* ===== خلفية متعددة الطبقات ===== */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1128] via-[#0f1c3f] to-slate-950" />
        <motion.div
          style={{ opacity: ambientOpacity, rotate: bgGradientRotate }}
          className="absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_50%,#1e3a8a_0deg,transparent_90deg,#0891b2_180deg,transparent_270deg,#1e3a8a_360deg)] opacity-20 blur-3xl"
        />
        <motion.div
          style={{ opacity: ambientOpacity, left: orb1X }}
          className="absolute top-[15%] w-72 h-72 md:w-96 md:h-96 rounded-full bg-amber-500/20 blur-[100px]"
        />
        <motion.div
          style={{ opacity: ambientOpacity, left: orb2X }}
          className="absolute bottom-[15%] w-72 h-72 md:w-96 md:h-96 rounded-full bg-blue-500/20 blur-[100px]"
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* توهج علوي وسفلي لعمق أكبر */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-950 to-transparent z-[5]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent z-[5]" />

        {/* ===== مؤشر تقدّم جانبي ===== */}
        <div className="hidden md:flex flex-col gap-4 absolute left-8 top-1/2 -translate-y-1/2 z-40">
          {[dot1, dot2, dot3].map((d, i) => (
            <motion.div
              key={i}
              style={{ opacity: d, scale: d }}
              className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
            />
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-center w-full h-full px-4">
          {/* ===== المشهد ١: الصندوق ===== */}
          <motion.div
            style={{ opacity: boxOpacity, scale: boxScale, y: boxY, rotate: boxRotate }}
            className="absolute flex flex-col items-center justify-center"
          >
            <motion.div className="relative flex items-center justify-center">
              <motion.div
                style={{ opacity: boxGlow }}
                className="absolute w-44 h-44 md:w-64 md:h-64 rounded-full bg-amber-400/40 blur-[60px]"
              />
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="relative"
              >
                <Package
                  className="w-28 h-28 md:w-44 md:h-44 text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.5)]"
                  strokeWidth={1}
                />
              </motion.div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                className="absolute -z-10 w-56 h-56 md:w-80 md:h-80 rounded-full border border-amber-400/20 border-dashed"
              />
            </motion.div>

            <motion.h1
              style={{ opacity: text1Opacity, y: text1Y, filter: useTransform(text1Blur, (v) => `blur(${v}px)`) }}
              className="text-3xl md:text-6xl font-black mt-8 text-center leading-tight"
            >
              شنو اللي تحتاجه <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                اليوم؟
              </span>
            </motion.h1>
          </motion.div>

          {/* ===== المشهد ٢: الأيقونات المتطايرة ===== */}
          <motion.div style={{ opacity: itemsOpacity, scale: itemsScale }} className="absolute inset-0 flex items-center justify-center">
            <FloatingIcon x={pillX} y={pillY} rotate={pillRotate} color="pink" Icon={Pill} delay={0} />
            <FloatingIcon x={bagX} y={bagY} rotate={bagRotate} color="orange" Icon={ShoppingBag} delay={0.15} />
            <FloatingIcon x={shirtX} y={shirtY} rotate={shirtRotate} color="cyan" Icon={Shirt} delay={0.3} />
            <FloatingIcon x={giftX} y={giftY} rotate={giftRotate} color="purple" Icon={Gift} delay={0.45} />

            {/* شرارات زخرفية */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
              className="absolute text-amber-300/40"
            >
              <Sparkles className="w-6 h-6 -translate-x-24 -translate-y-24" />
              <Sparkles className="w-4 h-4 translate-x-28 translate-y-16" />
            </motion.div>

            <motion.h2
              style={{ opacity: text2Opacity, y: text2Y }}
              className="absolute top-[18%] md:top-1/4 text-2xl md:text-5xl font-bold text-center w-full px-4 leading-relaxed"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-blue-100 to-blue-300">
                صيدلية، مطعم، أسواق،
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-blue-100 to-blue-300">
                أو أي شيء ببالك...
              </span>
            </motion.h2>
          </motion.div>

          {/* ===== المشهد ٣: الدراجة ===== */}
          <motion.div style={{ opacity: bikeOpacity }} className="absolute flex flex-col items-center justify-center w-full h-full">
            {/* خط طريق متحرك */}
            <motion.div
              style={{ opacity: roadLineOpacity }}
              className="absolute bottom-[38%] md:bottom-[35%] w-[85%] h-px overflow-hidden"
            >
              <motion.div
                animate={{ x: ["-100%", "100%"] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-300/70 to-transparent"
              />
            </motion.div>

            <motion.div style={{ x: bikeX, scale: bikeScale }} className="relative text-white flex items-center justify-center">
              <motion.div
                style={{ opacity: bikeGlow }}
                className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 blur-[70px] opacity-40 rounded-full w-56 h-56"
              />
              <Bike
                className="w-20 h-20 md:w-36 md:h-36 relative z-10 drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]"
                strokeWidth={1.5}
              />
              <motion.div
                animate={{ x: [0, -24, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 0.45, ease: "easeInOut" }}
                className="absolute -right-10 top-1/2 -translate-y-1/2 flex flex-col gap-2"
              >
                <div className="h-1 w-10 bg-blue-300 rounded-full" />
                <div className="h-1 w-14 bg-cyan-200 rounded-full ml-4" />
                <div className="h-1 w-7 bg-white rounded-full" />
              </motion.div>
            </motion.div>

            <motion.h2
              style={{ opacity: text3Opacity, y: text3Y }}
              className="absolute bottom-[20%] md:bottom-1/4 w-[92%] md:w-[70%] text-center leading-tight"
            >
              <span className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-blue-200">
                أبو الأكبر للتوصيل الشامل
              </span>
              <br />
              <span className="text-lg md:text-3xl mt-4 block text-blue-200 font-normal">
                ومو بس هيج... فتحنالك متجر إلكتروني بيه كلشي!
              </span>
            </motion.h2>
          </motion.div>
        </div>

        {/* ===== دعوة للسكرول ===== */}
        <motion.div
          style={{ opacity: scrollHintOpacity }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center z-50"
        >
          <span className="text-sm font-bold mb-3 tracking-widest text-amber-400 drop-shadow-lg">اسحب للأسفل</span>
          <motion.div
            animate={{ y: [0, 14, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="bg-amber-400 text-slate-900 rounded-full p-2 shadow-[0_0_25px_rgba(251,191,36,0.7)]"
          >
            <ChevronDown className="w-7 h-7" />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ===== مكوّن أيقونة عائمة بتصميم زجاجي (glass card) =====
function FloatingIcon({
  x,
  y,
  rotate,
  color,
  Icon,
  delay,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rotate: MotionValue<number>;
  color: "pink" | "orange" | "cyan" | "purple";
  Icon: React.ElementType;
  delay: number;
}) {
  const colorMap: Record<string, { text: string; glow: string; ring: string }> = {
    pink: { text: "text-pink-300", glow: "shadow-[0_0_30px_rgba(244,114,182,0.45)]", ring: "border-pink-400/30" },
    orange: { text: "text-orange-300", glow: "shadow-[0_0_30px_rgba(251,146,60,0.45)]", ring: "border-orange-400/30" },
    cyan: { text: "text-cyan-300", glow: "shadow-[0_0_30px_rgba(34,211,238,0.45)]", ring: "border-cyan-400/30" },
    purple: { text: "text-purple-300", glow: "shadow-[0_0_30px_rgba(192,132,252,0.45)]", ring: "border-purple-400/30" },
  };
  const c = colorMap[color];

  return (
    <motion.div style={{ x, y, rotate }} className="absolute">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, delay, ease: "easeInOut" }}
        className={`flex items-center justify-center rounded-2xl border ${c.ring} bg-white/5 backdrop-blur-md p-4 md:p-6 ${c.glow}`}
      >
        <Icon className={`w-8 h-8 md:w-14 md:h-14 ${c.text}`} strokeWidth={1.5} />
      </motion.div>
    </motion.div>
  );
}
