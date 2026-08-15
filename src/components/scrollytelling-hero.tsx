"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Package, Pill, ShoppingBag, Shirt, Gift, Bike, Zap, ChevronDown } from "lucide-react";

export default function ScrollytellingHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Scene 1: The Box (0% to 30%)
  const boxScale = useTransform(scrollYProgress, [0, 0.15, 0.3], [1, 1.2, 0]);
  const boxOpacity = useTransform(scrollYProgress, [0, 0.2, 0.25], [1, 1, 0]);
  const boxY = useTransform(scrollYProgress, [0, 0.2], [0, 100]);
  const text1Opacity = useTransform(scrollYProgress, [0, 0.15, 0.25], [1, 1, 0]);

  // Scene 2: Items flying out (25% to 65%)
  const itemsOpacity = useTransform(scrollYProgress, [0.25, 0.3, 0.55, 0.65], [0, 1, 1, 0]);
  const itemsScale = useTransform(scrollYProgress, [0.25, 0.35, 0.55], [0.3, 1.2, 1.8]);
  const text2Opacity = useTransform(scrollYProgress, [0.28, 0.35, 0.55, 0.65], [0, 1, 1, 0]);
  
  // Spread out paths
  const pillX = useTransform(scrollYProgress, [0.25, 0.5], [0, -150]);
  const pillY = useTransform(scrollYProgress, [0.25, 0.5], [0, -150]);
  const pillRotate = useTransform(scrollYProgress, [0.25, 0.55], [0, -90]);

  const bagX = useTransform(scrollYProgress, [0.25, 0.5], [0, 150]);
  const bagY = useTransform(scrollYProgress, [0.25, 0.5], [0, -100]);
  const bagRotate = useTransform(scrollYProgress, [0.25, 0.55], [0, 90]);

  const shirtX = useTransform(scrollYProgress, [0.25, 0.5], [0, -120]);
  const shirtY = useTransform(scrollYProgress, [0.25, 0.5], [0, 120]);
  const shirtRotate = useTransform(scrollYProgress, [0.25, 0.55], [0, -45]);
  
  const giftX = useTransform(scrollYProgress, [0.25, 0.5], [0, 120]);
  const giftY = useTransform(scrollYProgress, [0.25, 0.5], [0, 150]);
  const giftRotate = useTransform(scrollYProgress, [0.25, 0.55], [0, 45]);

  // Scene 3: The Bike (60% to 100%)
  const bikeOpacity = useTransform(scrollYProgress, [0.6, 0.65, 0.95, 1], [0, 1, 1, 0]);
  const bikeX = useTransform(scrollYProgress, [0.6, 0.8, 1], [300, 0, -300]);
  const bikeScale = useTransform(scrollYProgress, [0.6, 0.8], [0.5, 1.2]);
  const text3Opacity = useTransform(scrollYProgress, [0.65, 0.75, 0.9, 1], [0, 1, 1, 0]);

  const containerOpacity = useTransform(scrollYProgress, [0.95, 1], [1, 0]);

  return (
    <div ref={containerRef} className="h-[400vh] bg-slate-900 relative w-full">
      <motion.div 
        style={{ opacity: containerOpacity }}
        className="sticky top-0 h-screen overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-900 text-white w-full"
      >
        <div className="absolute inset-0 opacity-10 bg-[url('/pattern.svg')]" />
        
        <div className="relative z-10 flex items-center justify-center w-full h-full">
          <motion.div 
            style={{ opacity: boxOpacity, scale: boxScale, y: boxY }}
            className="absolute flex flex-col items-center justify-center"
          >
            <Package className="w-32 h-32 md:w-48 md:h-48 text-amber-400" strokeWidth={1} />
            <motion.h1 style={{ opacity: text1Opacity }} className="text-3xl md:text-6xl font-black mt-8 text-center leading-tight">
              شنو اللي تحتاجه <br/> <span className="text-amber-400">اليوم؟</span>
            </motion.h1>
          </motion.div>

          <motion.div style={{ opacity: itemsOpacity, scale: itemsScale }} className="absolute inset-0 flex items-center justify-center">
             <motion.div style={{ x: pillX, y: pillY, rotate: pillRotate }} className="absolute text-pink-400 drop-shadow-[0_0_15px_rgba(244,114,182,0.5)]">
               <Pill className="w-12 h-12 md:w-20 md:h-20" />
             </motion.div>
             <motion.div style={{ x: bagX, y: bagY, rotate: bagRotate }} className="absolute text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]">
               <ShoppingBag className="w-12 h-12 md:w-20 md:h-20" />
             </motion.div>
             <motion.div style={{ x: shirtX, y: shirtY, rotate: shirtRotate }} className="absolute text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
               <Shirt className="w-12 h-12 md:w-20 md:h-20" />
             </motion.div>
             <motion.div style={{ x: giftX, y: giftY, rotate: giftRotate }} className="absolute text-purple-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.5)]">
               <Gift className="w-12 h-12 md:w-20 md:h-20" />
             </motion.div>
             
             <motion.h2 style={{ opacity: text2Opacity }} className="absolute top-1/4 text-2xl md:text-5xl font-bold text-center text-blue-200 w-full px-4 leading-relaxed">
                صيدلية، مطعم، أسواق، <br/> أو أي شيء ببالك...
             </motion.h2>
          </motion.div>

          <motion.div style={{ opacity: bikeOpacity }} className="absolute flex flex-col items-center justify-center w-full h-full">
             <motion.div style={{ x: bikeX, scale: bikeScale }} className="relative text-white flex items-center justify-center">
               <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-40 rounded-full w-48 h-48" />
               <Bike className="w-24 h-24 md:w-40 md:h-40 relative z-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]" strokeWidth={1.5} />
               <motion.div 
                 animate={{ x: [0, -20, 0], opacity: [0.5, 1, 0.5] }} 
                 transition={{ repeat: Infinity, duration: 0.5 }}
                 className="absolute -right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2"
               >
                 <div className="h-1 w-8 bg-blue-300 rounded-full"></div>
                 <div className="h-1 w-12 bg-blue-200 rounded-full ml-4"></div>
                 <div className="h-1 w-6 bg-white rounded-full"></div>
               </motion.div>
             </motion.div>
             
             <motion.h2 style={{ opacity: text3Opacity }} className="absolute bottom-1/4 w-[90%] md:w-[200%] text-center text-3xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-white to-blue-200 leading-tight">
               خصيب ستور يوصلها <br/> لباب بيتك فوراً!
             </motion.h2>
          </motion.div>
        </div>
        
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
           <span className="text-sm font-bold mb-3 tracking-widest text-yellow-400 drop-shadow-lg">اسحب للأسفل</span>
           <motion.div 
             animate={{ y: [0, 15, 0] }} 
             transition={{ repeat: Infinity, duration: 1.5 }}
             className="bg-yellow-400 text-slate-900 rounded-full p-2 shadow-[0_0_20px_rgba(250,204,21,0.6)]"
           >
             <ChevronDown className="w-8 h-8" />
           </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
