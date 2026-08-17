"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ShoppingBag, Gift, Pill, MapPin, Bike } from "lucide-react";

export default function ScrollytellingHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: rawProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  
  // Use spring for smoother mobile experience
  const p = useSpring(rawProgress, { stiffness: 100, damping: 25, mass: 0.5 });

  // Thread animation
  const threadScale = useTransform(p, [0, 0.9], [0, 1]);
  const threadCapTop = useTransform(p, [0, 0.9], ["0%", "100%"]);
  const threadCapOpacity = useTransform(p, [0.03, 0.05, 0.8, 0.85], [0, 1, 1, 0]);
  const threadOpacity = useTransform(p, [0.8, 0.85], [1, 0]);

  // Headlines
  // VISIBLE ON LOAD, fades out fast
  const h1Opacity = useTransform(p, [0, 0.04], [1, 0]);
  const h1Y = useTransform(p, [0, 0.04], [0, -20]);
  
  // "من الصيدلية للهدية..." Appears BEFORE stops
  const h2Opacity = useTransform(p, [0.06, 0.1, 0.16, 0.2], [0, 1, 1, 0]);
  const h2Y = useTransform(p, [0.06, 0.1, 0.16, 0.2], [20, 0, 0, -20]);

  // Stops appear after h2 fades out
  const stop1Opacity = useTransform(p, [0.22, 0.26, 0.8, 0.85], [0, 1, 1, 0]);
  const stop1Y = useTransform(p, [0.22, 0.26], [20, 0]);
  const stop1Scale = useTransform(p, [0.22, 0.26], [0.8, 1]);

  const stop2Opacity = useTransform(p, [0.36, 0.4, 0.8, 0.85], [0, 1, 1, 0]);
  const stop2Y = useTransform(p, [0.36, 0.4], [20, 0]);
  const stop2Scale = useTransform(p, [0.36, 0.4], [0.8, 1]);

  const stop3Opacity = useTransform(p, [0.5, 0.54, 0.8, 0.85], [0, 1, 1, 0]);
  const stop3Y = useTransform(p, [0.5, 0.54], [20, 0]);
  const stop3Scale = useTransform(p, [0.5, 0.54], [0.8, 1]);

  const stop4Opacity = useTransform(p, [0.64, 0.68, 0.8, 0.85], [0, 1, 1, 0]);
  const stop4Y = useTransform(p, [0.64, 0.68], [20, 0]);
  const stop4Scale = useTransform(p, [0.64, 0.68], [0.8, 1]);


  // Final Scene
  const finalOpacity = useTransform(p, [0.86, 0.9], [0, 1]);
  const finalY = useTransform(p, [0.86, 0.9], [20, 0]);

  const hintOpacity = useTransform(rawProgress, [0, 0.05], [1, 0]);

  return (
    <div ref={containerRef} className="h-[280vh] relative w-full font-['IBM_Plex_Sans_Arabic']" style={{ background: "#F6FAFD", color: "#22323F" }}>
      
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center">
        
        {/* Thread Animation Center */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 -translate-x-1/2 top-[10%] bottom-[10%] w-[2px] bg-[#BFE0F2]/30" />
          <motion.div style={{ scaleY: threadScale, opacity: threadOpacity }} className="absolute left-1/2 -translate-x-1/2 top-[10%] bottom-[10%] w-[3px] bg-[#5FA8D3] origin-top" />
          <motion.div style={{ top: threadCapTop, opacity: threadCapOpacity }} className="absolute left-1/2 -translate-x-1/2 w-[12px] h-[12px] rounded-full bg-[#5FA8D3] -mt-[6px]" />
        </div>

        {/* Stops */}
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Stop 1 */}
          <motion.div style={{ opacity: stop1Opacity, y: stop1Y, scale: stop1Scale }} className="absolute top-[28%] right-[calc(50%+15px)] md:right-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] flex-row-reverse text-right">
            <div className="absolute top-1/2 -right-[15px] md:-right-[26px] w-[15px] md:w-[26px] h-[2px] bg-[#BFE0F2]" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative border border-[#BFE0F2]">
              <Pill className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-bold block mb-1">٠١</span>
              <span className="text-[14px] md:text-[16px] text-[#22323F] font-bold">صيدلية وأدوية</span>
            </div>
          </motion.div>

          {/* Stop 2 */}
          <motion.div style={{ opacity: stop2Opacity, y: stop2Y, scale: stop2Scale }} className="absolute top-[42%] left-[calc(50%+15px)] md:left-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] text-left">
            <div className="absolute top-1/2 -left-[15px] md:-left-[26px] w-[15px] md:w-[26px] h-[2px] bg-[#BFE0F2]" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative border border-[#BFE0F2]">
              <MapPin className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-bold block mb-1">٠٢</span>
              <span className="text-[14px] md:text-[16px] text-[#22323F] font-bold">مطعم وأكلات</span>
            </div>
          </motion.div>

          {/* Stop 3 */}
          <motion.div style={{ opacity: stop3Opacity, y: stop3Y, scale: stop3Scale }} className="absolute top-[56%] right-[calc(50%+15px)] md:right-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] flex-row-reverse text-right">
            <div className="absolute top-1/2 -right-[15px] md:-right-[26px] w-[15px] md:w-[26px] h-[2px] bg-[#BFE0F2]" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative border border-[#BFE0F2]">
              <ShoppingBag className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-bold block mb-1">٠٣</span>
              <span className="text-[14px] md:text-[16px] text-[#22323F] font-bold">سوبرماركت ومخضر</span>
            </div>
          </motion.div>

          {/* Stop 4 */}
          <motion.div style={{ opacity: stop4Opacity, y: stop4Y, scale: stop4Scale }} className="absolute top-[70%] left-[calc(50%+15px)] md:left-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] text-left">
            <div className="absolute top-1/2 -left-[15px] md:-left-[26px] w-[15px] md:w-[26px] h-[2px] bg-[#BFE0F2]" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative border border-[#BFE0F2]">
              <Gift className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.5} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-bold block mb-1">٠٤</span>
              <span className="text-[14px] md:text-[16px] text-[#22323F] font-bold">هدايا وكلشي!</span>
            </div>
          </motion.div>
        </div>

        {/* Headlines */}
        <motion.div style={{ opacity: h1Opacity, y: h1Y }} className="absolute left-1/2 top-[20%] -translate-x-1/2 w-[90vw] md:w-[620px] text-center z-10 pointer-events-none">
          <h2 className="font-bold tracking-[1px] text-[32px] md:text-[46px] leading-[1.4] text-[#22323F]">
            أبو الأكبر للتوصيل<br/><span className="text-[#5FA8D3]">تجربة توصيل بمستوى ثاني</span>
          </h2>
          <div className="w-[56px] h-[3px] rounded-full bg-[#BFE0F2] mx-auto mt-4" />
        </motion.div>

        <motion.div style={{ opacity: h2Opacity, y: h2Y }} className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-[90vw] md:w-[500px] text-center z-10 pointer-events-none bg-white/90 p-8 rounded-[24px] border border-[#BFE0F2] shadow-lg">
          <h2 className="font-bold tracking-[1px] text-[24px] md:text-[32px] leading-[1.4] text-[#22323F] mb-4">
            من الصيدلية للهدية...<br/><span className="text-[#5FA8D3]">كلشي بطلب واحد</span>
          </h2>
          <p className="text-[#22323F]/80 text-[16px] md:text-[18px] font-medium leading-relaxed">يعني شنو نوصل لك؟ أي شي! أدوية، مخضر، مطاعم، هدايا، كوزمتك، كل اللي تريده يوصلك للباب.</p>
        </motion.div>

        {/* Final Scene */}
        <motion.div style={{ opacity: finalOpacity, y: finalY }} className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-[12px] z-10 text-center w-[90vw] md:w-full">
          <div className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center border-2 border-[#5FA8D3] shadow-lg">
            <Bike className="w-[32px] h-[32px] text-[#5FA8D3]" strokeWidth={1.5} />
          </div>
          <h2 className="font-bold text-[32px] md:text-[42px] text-[#22323F] tracking-tight">إحنا خدمة توصيل شاملة</h2>
          <p className="text-[#5FA8D3] font-bold text-[18px] md:text-[20px] mb-2">مدعومة بمتجر تسوق شامل (خصيبي ستور).</p>
          <div className="w-[80px] h-[3px] rounded-full bg-[#BFE0F2] mx-auto mb-2" />
          <p className="text-[#22323F]/90 text-[16px] md:text-[18px] max-w-[600px] font-bold leading-loose">
            إحنا خدمة توصيل شاملة داخل أبي الخصيب... يعني وأنت بالبيت، بالدوام، أو طالع تفتح واتساب تراسلني تطلب أي شي (أي شي!) راح أشتريه ونوصله إلك للبيت.
          </p>
        </motion.div>

        {/* Scroll Hint */}
        <motion.div style={{ opacity: hintOpacity }} className="absolute bottom-[3%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[10px] z-10 pointer-events-none">
          <motion.div animate={{ y: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} className="w-[42px] h-[42px] flex flex-col items-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-[#5FA8D3]">
              <path d="M12 5v14M12 5l-4 4M12 5l4 4"/>
              <path d="M15 16h-3c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2s2 .9 2 2v2"/>
            </svg>
          </motion.div>
          <span className="text-[18px] font-bold tracking-[2px] text-[#5FA8D3]">اسحب</span>
        </motion.div>

      </div>
    </div>
  );
}
