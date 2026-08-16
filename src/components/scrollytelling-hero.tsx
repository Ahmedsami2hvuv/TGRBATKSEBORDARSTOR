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
  const threadScale = useTransform(p, [0, 0.85], [0, 1]);
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
  // VISIBLE ON LOAD
  const h1Opacity = useTransform(p, [0, 0.15], [1, 0]);
  const h1Blur = useTransform(p, [0, 0.15], [0, 8]);
  
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
        <motion.div style={{ height: railHeight }} className="w-full bg-[#5FA8D3] rounded-full origin-top" />
      </div>

      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col items-center justify-center">
        
        {/* Thread Animation Center */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 -translate-x-1/2 top-[10%] bottom-[10%] w-[2px] bg-[#BFE0F2]/30" />
          <motion.div style={{ scaleY: threadScale }} className="absolute left-1/2 -translate-x-1/2 top-[10%] bottom-[10%] w-[2px] bg-gradient-to-b from-[#5FA8D3] to-[#BFE0F2] origin-top shadow-[0_0_12px_rgba(95,168,211,0.6)]" />
          <motion.div style={{ top: threadCapTop, opacity: threadCapOpacity }} className="absolute left-1/2 -translate-x-1/2 w-[8px] h-[8px] rounded-full bg-[#5FA8D3] shadow-[0_0_10px_#5FA8D3] -mt-[4px]" />
        </div>

        {/* Stops */}
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Stop 1 */}
          <motion.div style={{ opacity: stop1Opacity, filter: useTransform(stop1Blur, b => "blur(" + b + "px)"), y: stop1Y, scale: stop1Scale }} className="absolute top-[28%] right-[calc(50%+15px)] md:right-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] flex-row-reverse text-right">
            <div className="absolute top-1/2 -right-[15px] md:-right-[26px] w-[15px] md:w-[26px] h-[2px] bg-gradient-to-l from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <Pill className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠١</span>
              <span className="text-[12px] sm:text-[14px] md:text-[15px] text-[#22323F] font-medium">صيدلية وأدوية</span>
            </div>
          </motion.div>

          {/* Stop 2 */}
          <motion.div style={{ opacity: stop2Opacity, filter: useTransform(stop2Blur, b => "blur(" + b + "px)"), y: stop2Y, scale: stop2Scale }} className="absolute top-[42%] left-[calc(50%+15px)] md:left-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] text-left">
            <div className="absolute top-1/2 -left-[15px] md:-left-[26px] w-[15px] md:w-[26px] h-[2px] bg-gradient-to-r from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <MapPin className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠٢</span>
              <span className="text-[12px] sm:text-[14px] md:text-[15px] text-[#22323F] font-medium">مطعم وأكلات</span>
            </div>
          </motion.div>

          {/* Stop 3 */}
          <motion.div style={{ opacity: stop3Opacity, filter: useTransform(stop3Blur, b => "blur(" + b + "px)"), y: stop3Y, scale: stop3Scale }} className="absolute top-[56%] right-[calc(50%+15px)] md:right-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] flex-row-reverse text-right">
            <div className="absolute top-1/2 -right-[15px] md:-right-[26px] w-[15px] md:w-[26px] h-[2px] bg-gradient-to-l from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <ShoppingBag className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠٣</span>
              <span className="text-[12px] sm:text-[14px] md:text-[15px] text-[#22323F] font-medium">سوبرماركت ومخضر</span>
            </div>
          </motion.div>

          {/* Stop 4 */}
          <motion.div style={{ opacity: stop4Opacity, filter: useTransform(stop4Blur, b => "blur(" + b + "px)"), y: stop4Y, scale: stop4Scale }} className="absolute top-[70%] left-[calc(50%+15px)] md:left-[calc(50%+26px)] w-[140px] md:w-[200px] flex items-center gap-[14px] text-left">
            <div className="absolute top-1/2 -left-[15px] md:-left-[26px] w-[15px] md:w-[26px] h-[2px] bg-gradient-to-r from-[#BFE0F2] to-transparent" />
            <div className="shrink-0 w-[54px] h-[54px] md:w-[68px] md:h-[68px] rounded-full bg-white flex items-center justify-center relative shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
              <Gift className="w-[20px] h-[20px] md:w-[26px] md:h-[26px] text-[#5FA8D3]" strokeWidth={1.4} />
            </div>
            <div>
              <span className="text-[11px] tracking-[3px] text-[#5FA8D3] font-medium block mb-1">٠٤</span>
              <span className="text-[12px] sm:text-[14px] md:text-[15px] text-[#22323F] font-medium">هدايا وكوزمتك وكلشي!</span>
            </div>
          </motion.div>
        </div>

        {/* Headlines */}
        <motion.div style={{ opacity: h1Opacity, filter: useTransform(h1Blur, b => "blur(" + b + "px)") }} className="absolute left-1/2 top-[16%] -translate-x-1/2 w-[min(90vw,620px)] text-center z-10 pointer-events-none">
          <h2 className="font-bold tracking-[1px] text-[clamp(26px,5vw,46px)] leading-[1.4] text-[#22323F]">
            أبو الأكبر للتوصيل<br/><span className="text-[#5FA8D3]">تجربة توصيل بمستوى ثاني</span>
          </h2>
          <div className="w-[56px] h-[2px] rounded-full bg-[#BFE0F2] mx-auto mt-[18px]" />
        </motion.div>

        <motion.div style={{ opacity: h2Opacity, filter: useTransform(h2Blur, b => "blur(" + b + "px)") }} className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-[min(90vw,620px)] text-center z-10 pointer-events-none bg-white/70 backdrop-blur-md p-6 rounded-[24px] border border-[#BFE0F2]/50 shadow-sm">
          <h2 className="font-bold tracking-[1px] text-[clamp(20px,4vw,32px)] leading-[1.4] text-[#22323F] mb-4">
            من الصيدلية للهدية...<br/><span className="text-[#5FA8D3]">كلشي بطلب واحد</span>
          </h2>
          <p className="text-[#22323F]/80 text-[15px] leading-relaxed">يعني شنو نوصل لك؟ أي شي! أدوية، مخضر، مطاعم، هدايا، كوزمتك، كل اللي تريده يوصلك للباب.</p>
        </motion.div>

        {/* Final Scene */}
        <motion.div style={{ opacity: finalOpacity, filter: useTransform(finalBlur, b => "blur(" + b + "px)") }} className="absolute bottom-[6%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[10px] z-10 text-center w-full px-4">
          <div className="w-[84px] h-[84px] rounded-full bg-white flex items-center justify-center shadow-[0_10px_30px_rgba(95,168,211,0.28),inset_0_0_0_1px_rgba(191,224,242,0.7)]">
            <Bike className="w-[32px] h-[32px] text-[#5FA8D3]" strokeWidth={1.3} />
          </div>
          <h2 className="font-bold text-[clamp(28px,7vw,64px)] text-[#22323F] tracking-tight mb-2">إحنا خدمة توصيل شاملة</h2>
          <p className="text-[#5FA8D3] font-bold text-[16px] md:text-[20px] mb-4">خدمة توصيل شاملة، مدعومة بمتجر تسوق شامل (خصيبي ستور).</p>
          <div className="w-[80px] h-[3px] rounded-full bg-gradient-to-r from-[#BFE0F2] to-transparent mx-auto mb-4" />
          <p className="text-[#22323F]/80 text-[13px] sm:text-[15px] md:text-[17px] max-w-[500px] font-medium leading-loose">
            إحنا خدمة توصيل داخل أبي الخصيب... يعني وأنت بالبيت، بالدوام، أو طالع تفتح واتساب تراسلني تطلب أي شي (أي شي!) راح أشتريه ونوصله إلك للبيت.
          </p>
        </motion.div>

        {/* Scroll Hint */}
        <motion.div style={{ opacity: hintOpacity }} className="absolute top-[80%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[14px] z-10">
          <motion.div animate={{ y: [25, -15], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }} className="w-[42px] h-[42px] flex flex-col items-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-[#5FA8D3]">
              <path d="M12 5v14M12 5l-4 4M12 5l4 4"/>
              <path d="M15 16h-3c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2s2 .9 2 2v2"/>
            </svg>
          </motion.div>
          <span className="text-[18px] font-bold tracking-[2px] text-[#5FA8D3] mt-2">اسحب</span>
        </motion.div>

      </div>
    </div>
  );
}
