"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ShoppingBag, Gift, Pill, MapPin, Bike, ChevronDown } from "lucide-react";

const SPRING = { stiffness: 90, damping: 20, mass: 0.5 };

export default function ScrollytellingHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: rawProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  
  const p = useSpring(rawProgress, SPRING);

  // Thread animation
  // Thread scales from 0 to 1 as p goes from 0 to 0.85
  const threadScale = useTransform(p, [0, 0.85], [0, 1]);
  // Thread cap position (top 0% to 100%)
  const threadCapTop = useTransform(p, [0, 0.85], ["0%", "100%"]);
  const threadCapOpacity = useTransform(p, [0.03, 0.06, 0.85, 0.88], [0, 1, 1, 0]);

  // Stops
  const stop1Opacity = useTransform(p, [0.26, 0.28], [0, 1]);
  const stop1Blur = useTransform(p, [0.26, 0.28], [6, 0]);
  const stop1Y = useTransform(p, [0.26, 0.28], [8, 0]);
  const stop1Scale = useTransform(p, [0.26, 0.28], [0.94, 1]);

  const stop2Opacity = useTransform(p, [0.4, 0.42], [0, 1]);
  const stop2Blur = useTransform(p, [0.4, 0.42], [6, 0]);
  const stop2Y = useTransform(p, [0.4, 0.42], [8, 0]);
  const stop2Scale = useTransform(p, [0.4, 0.42], [0.94, 1]);

  const stop3Opacity = useTransform(p, [0.54, 0.56], [0, 1]);
  const stop3Blur = useTransform(p, [0.54, 0.56], [6, 0]);
  const stop3Y = useTransform(p, [0.54, 0.56], [8, 0]);
  const stop3Scale = useTransform(p, [0.54, 0.56], [0.94, 1]);

  const stop4Opacity = useTransform(p, [0.68, 0.70], [0, 1]);
  const stop4Blur = useTransform(p, [0.68, 0.70], [6, 0]);
  const stop4Y = useTransform(p, [0.68, 0.70], [8, 0]);
  const stop4Scale = useTransform(p, [0.68, 0.70], [0.94, 1]);

  // Headlines
  const h1Opacity = useTransform(p, [0.02, 0.1, 0.2, 0.24], [0, 1, 1, 0]);
  const h1Blur = useTransform(p, [0.02, 0.1, 0.2, 0.24], [8, 0, 0, 8]);
  
  const h2Opacity = useTransform(p, [0.3, 0.38, 0.5, 0.58], [0, 1, 1, 0]);
  const h2Blur = useTransform(p, [0.3, 0.38, 0.5, 0.58], [8, 0, 0, 8]);

  // Final
  const finalOpacity = useTransform(p, [0.8, 0.85], [0, 1]);
  const finalBlur = useTransform(p, [0.8, 0.85], [6, 0]);

  const hintOpacity = useTransform(rawProgress, [0, 0.04], [1, 0]);
  const railHeight = useTransform(rawProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={containerRef} className="h-[380vh] relative w-full font-['IBM_Plex_Sans_Arabic']" style={{ background: "#F6FAFD", color: "#22323F" }}>
      
      {/* Scroll Rail */}
      <div className="fixed left-6 top-[14vh] bottom-[14vh] w-[2px] bg-[#5FA8D3]/15 rounded-full z-20 hidden md:block">
        <motion.div style={{ height: railHeight }} className="absolute top-0 right-0 left-0 w-full rounded-full bg-[#5FA8D3]" />
      </div>

      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        
        {/* Background Gradients */}
        <div 
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 55% 40% at 25% 15%, rgba(191,224,242,0.65), transparent 65%), radial-gradient(ellipse 60% 45% at 80% 85%, rgba(191,224,242,0.55), transparent 65%), linear-gradient(180deg, #F6FAFD 0%, #E7F2FA 50%, #F6FAFD 100%)"
          }}
        />
        <div className="absolute top-[6%] -right-[8%] w-[38vw] h-[38vw] rounded-full blur-[60px] opacity-50 bg-[radial-gradient(circle,rgba(255,255,255,0.9),rgba(191,224,242,0.2))] hidden md:block" />
        <div className="absolute bottom-[8%] -left-[6%] w-[30vw] h-[30vw] rounded-full blur-[60px] opacity-50 bg-[radial-gradient(circle,rgba(255,255,255,0.9),rgba(191,224,242,0.2))] hidden md:block" />

        <div className="absolute left-0 right-0 top-0 h-[16vh] z-10 pointer-events-none bg-gradient-to-b from-[#F6FAFD] to-transparent" />
        <div className="absolute left-0 right-0 bottom-0 h-[16vh] z-10 pointer-events-none bg-gradient-to-t from-[#F6FAFD] to-transparent" />

        {/* Map Thread */}
        <div className="relative w-[min(94vw,560px)] h-[88vh] z-[2]">
          <motion.div 
            style={{ scaleY: threadScale }}
            className="absolute right-1/2 top-0 w-[2px] h-full origin-top rounded-full bg-gradient-to-b from-transparent via-[#5FA8D3] to-transparent" 
          />
          <motion.div 
            style={{ top: threadCapTop, opacity: threadCapOpacity }}
            className="absolute right-[calc(50%-5px)] w-[10px] h-[10px] rounded-full bg-white border-2 border-[#5FA8D3] shadow-[0_2px_10px_rgba(95,168,211,0.4)]"
          />

          {/* Stop 1 */}
          <motion.div style={{ opacity: stop1Opacity, filter: useTransform(stop1Blur, b => "blur(" + b + "px)"), y: stop1Y, scale: stop1Scale }} className="absolute top-[28%] right-[calc(50%+26px)] w-[200px] flex items-center gap-[14px] flex-row-reverse text-right">
            <div className="absolute top-1/2 -right-[26px] w-[26px] h-[2px] bg-gradient-to-l from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[68px] h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <Pill className="w-[26px] h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠١</span>
              <span className="text-[15px] text-[#22323F] font-medium">صيدلية</span>
            </div>
          </motion.div>

          {/* Stop 2 */}
          <motion.div style={{ opacity: stop2Opacity, filter: useTransform(stop2Blur, b => "blur(" + b + "px)"), y: stop2Y, scale: stop2Scale }} className="absolute top-[42%] left-[calc(50%+26px)] w-[200px] flex items-center gap-[14px] text-left">
            <div className="absolute top-1/2 -left-[26px] w-[26px] h-[2px] bg-gradient-to-r from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[68px] h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <MapPin className="w-[26px] h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠٢</span>
              <span className="text-[15px] text-[#22323F] font-medium">مطعم</span>
            </div>
          </motion.div>

          {/* Stop 3 */}
          <motion.div style={{ opacity: stop3Opacity, filter: useTransform(stop3Blur, b => "blur(" + b + "px)"), y: stop3Y, scale: stop3Scale }} className="absolute top-[56%] right-[calc(50%+26px)] w-[200px] flex items-center gap-[14px] flex-row-reverse text-right">
            <div className="absolute top-1/2 -right-[26px] w-[26px] h-[2px] bg-gradient-to-l from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[68px] h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <ShoppingBag className="w-[26px] h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠٣</span>
              <span className="text-[15px] text-[#22323F] font-medium">سوبرماركت</span>
            </div>
          </motion.div>

          {/* Stop 4 */}
          <motion.div style={{ opacity: stop4Opacity, filter: useTransform(stop4Blur, b => "blur(" + b + "px)"), y: stop4Y, scale: stop4Scale }} className="absolute top-[70%] left-[calc(50%+26px)] w-[200px] flex items-center gap-[14px] text-left">
            <div className="absolute top-1/2 -left-[26px] w-[26px] h-[2px] bg-gradient-to-r from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[68px] h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <Gift className="w-[26px] h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠٤</span>
              <span className="text-[15px] text-[#22323F] font-medium">هدايا</span>
            </div>
          </motion.div>
        </div>

        {/* Headlines */}
        <motion.div style={{ opacity: h1Opacity, filter: useTransform(h1Blur, b => "blur(" + b + "px)") }} className="absolute left-1/2 top-[16%] -translate-x-1/2 w-[min(90vw,620px)] text-center z-10 pointer-events-none">
          <h2 className="font-bold tracking-[1px] text-[clamp(26px,5vw,46px)] leading-[1.4] text-[#22323F]">
            تجربة توصيل<br/><span className="text-[#5FA8D3]">بمستوى ثاني</span>
          </h2>
          <div className="w-[56px] h-[2px] rounded-full bg-[#BFE0F2] mx-auto mt-[18px]" />
        </motion.div>

        <motion.div style={{ opacity: h2Opacity, filter: useTransform(h2Blur, b => "blur(" + b + "px)") }} className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-[min(90vw,620px)] text-center z-10 pointer-events-none">
          <h2 className="font-bold tracking-[1px] text-[clamp(26px,5vw,46px)] leading-[1.4] text-[#22323F]">
            من الصيدلية للهديّة —<br/><span className="text-[#5FA8D3]">كلشي بطلب وحد</span>
          </h2>
        </motion.div>

        {/* Final Scene */}
        <motion.div style={{ opacity: finalOpacity, filter: useTransform(finalBlur, b => "blur(" + b + "px)") }} className="absolute bottom-[6%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[10px] z-10 text-center w-full px-4">
          <div className="w-[84px] h-[84px] rounded-full bg-white flex items-center justify-center shadow-[0_10px_30px_rgba(95,168,211,0.28),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
            <Bike className="w-[32px] h-[32px] text-[#5FA8D3]" strokeWidth={1.3} />
          </div>
          <h2 className="font-bold text-[clamp(34px,7vw,64px)] text-[#22323F] tracking-tight">أبو الأكبر</h2>
          <div className="w-[56px] h-[2px] rounded-full bg-[#BFE0F2] mx-auto mt-2 mb-2" />
          <p className="text-[#22323F]/60 text-[15px] max-w-[420px] font-medium leading-relaxed">
            خدمة توصيل شاملة، مدعومة بمتجر تسوق شامل.
          </p>
        </motion.div>

        {/* Scroll Hint */}
        <motion.div style={{ opacity: hintOpacity }} className="absolute top-[80%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[14px] z-10">
          <motion.div animate={{ y: [0, 8, 0], opacity: [0.55, 1, 0.55] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} className="w-[34px] h-[34px]">
            <ChevronDown className="w-full h-full text-[#5FA8D3]" strokeWidth={1.4} />
          </motion.div>
          <span className="text-[20px] font-bold tracking-[4px] text-[#5FA8D3]">اسحب</span>
        </motion.div>

      </div>
    </div>
  );
}
