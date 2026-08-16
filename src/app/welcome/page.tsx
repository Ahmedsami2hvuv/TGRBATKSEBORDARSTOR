"use client";

import React, { useEffect, useState, useRef } from "react";
import { getSocialLinksAction, SocialLinksConfig } from "@/lib/social-links";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import {
  Store, MessageCircle, Send, Users, Heart, Zap, MapPin, CheckCheck, Camera, Mic, Phone, Car, Clock, RotateCcw, Megaphone, Smartphone, ExternalLink, ArrowLeftRight, Banknote, ShoppingCart, UserPlus, Save, Pill, ShoppingBag, Gift, Bike
} from "lucide-react";
import Link from "next/link";

const regions3k = ['الابله', 'باب الزبير', 'الطويسه', 'العشار', 'الجمهوريه', 'خندق', 'الجزائر', 'بريهه', 'المعقل', 'الخمسه ميل', 'الاربع شوارع', 'الاندلس', 'الاستقلال', 'حي الجامعه', 'جنينه', 'الخضاره', 'الداكير', 'طريق بغداد', 'الكورنيش', 'المناوي', 'البراضعيه', 'مناوي باشا', 'الخوره', 'التميميه', 'العباسيه', 'القبله (لغاية حي المهندسين)', 'حي الحسين', 'كفاءات', 'ياسين خريبط', 'دور النواب', 'ام صلال', 'المقاولين', 'دور الشرطه', 'الطابو', 'نظران', 'شط العرب (لغاية الجامعه)', 'الامن الداخلي (لغاية كلية الكنوز)'];
const regions5k = ['شط العرب (مابعد الجامعه لغاية التنومه)', 'القبله (حي المهندسين ومابعده)', 'الامن الداخلي (مابعد كلية الكنوز)', 'الزبير', 'ابي الخصيب', 'ابو الخصيب', 'المفتيه', 'كرمة علي (لغاية جامعة البصره)', 'النجيبيه'];

function TimelineNode({ children, left = false, delay = 0, icon: Icon }: any) {
  return (
    <div className={`relative flex items-center justify-center w-full mb-16 md:mb-24 ${left ? 'md:flex-row-reverse' : 'md:flex-row'} flex-col gap-6 md:gap-12`}>
      {/* Node Content */}
      <motion.div 
        initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.7, delay, type: "spring", bounce: 0.3 }}
        className="w-full md:w-[45%] z-10"
      >
        {children}
      </motion.div>

      {/* Center Icon */}
      <motion.div 
        initial={{ opacity: 0, scale: 0 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.5, delay: delay + 0.2 }}
        className="hidden md:flex shrink-0 w-16 h-16 rounded-full bg-white items-center justify-center relative z-20 shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]"
      >
        <Icon className="w-7 h-7 text-[#5FA8D3]" strokeWidth={1.5} />
      </motion.div>

      {/* Empty space for the other side on desktop */}
      <div className="hidden md:block md:w-[45%]" />
    </div>
  );
}

export default function WelcomePage() {
  const [links, setLinks] = useState<SocialLinksConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  const threadScale = useTransform(smoothProgress, [0, 1], [0.05, 1]);

  useEffect(() => {
    getSocialLinksAction().then(data => setLinks(data));
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#F6FAFD] text-[#22323F] font-['IBM_Plex_Sans_Arabic'] overflow-x-hidden selection:bg-[#BFE0F2] selection:text-[#22323F] pb-32 pt-20">
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "radial-gradient(ellipse 55% 40% at 25% 15%, rgba(191,224,242,0.4), transparent 65%), radial-gradient(ellipse 60% 45% at 80% 85%, rgba(191,224,242,0.3), transparent 65%)" }} />
      
      {/* Continuous Vertical Thread */}
      <div className="absolute left-[24px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[3px] bg-[#BFE0F2]/30 z-0" />
      <motion.div 
        style={{ scaleY: threadScale }} 
        className="fixed left-[24px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#5FA8D3] to-[#BFE0F2] origin-top z-10 shadow-[0_0_15px_rgba(95,168,211,0.6)]" 
      />

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-6 md:px-4 relative z-20 pl-[48px] md:pl-4">

        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-32 md:mb-40 pt-10"
        >
          <div className="w-24 h-24 rounded-full bg-white mx-auto flex items-center justify-center shadow-[0_10px_30px_rgba(95,168,211,0.28),inset_0_0_0_1px_rgba(191,224,242,0.7)] mb-8">
            <Bike className="w-10 h-10 text-[#5FA8D3]" strokeWidth={1.3} />
          </div>
          <h1 className="font-bold tracking-tight text-[clamp(32px,8vw,64px)] leading-[1.2] text-[#22323F] mb-6">
            تجربة توصيل<br/><span className="text-[#5FA8D3]">بمستوى ثاني</span>
          </h1>
          <p className="text-[16px] md:text-[20px] text-[#22323F]/60 max-w-xl mx-auto font-medium">
            أبو الأكبر: خدمة توصيل شاملة، مدعومة بمتجر تسوق كامل.
          </p>

          <motion.div animate={{ y: [20, -5], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }} className="w-12 h-12 flex flex-col items-center mx-auto mt-16">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-[#5FA8D3]">
              <path d="M12 5v14M12 5l-4 4M12 5l4 4"/>
              <path d="M15 16h-3c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2s2 .9 2 2v2"/>
            </svg>
            <span className="text-[14px] font-bold tracking-[2px] text-[#5FA8D3] mt-2 whitespace-nowrap">اسحب للأسفل</span>
          </motion.div>
        </motion.div>

        {/* Timeline Stops (The Scrollytelling items) */}
        
        <TimelineNode left={false} icon={Pill}>
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-[24px] shadow-sm border border-[#BFE0F2]/50 text-right">
            <h3 className="text-[22px] font-bold mb-2 flex items-center gap-3 justify-end text-[#5FA8D3]">
              صيدلية <Pill className="w-6 h-6 md:hidden" />
            </h3>
            <p className="text-[#22323F]/70 text-[15px]">نوصلك الأدوية والمستلزمات الطبية من أي صيدلية في أي وقت، وبأسرع سرعة لحالاتك الطارئة.</p>
          </div>
        </TimelineNode>

        <TimelineNode left={true} icon={MapPin}>
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-[24px] shadow-sm border border-[#BFE0F2]/50 text-right md:text-left">
            <h3 className="text-[22px] font-bold mb-2 flex items-center gap-3 md:justify-start justify-end text-[#5FA8D3]">
              مطعم <MapPin className="w-6 h-6 md:hidden" />
            </h3>
            <p className="text-[#22323F]/70 text-[15px]">مشتهي أكل؟ اطلب من أي مطعم يعجبك ويوصلك حار لباب بيتك.</p>
          </div>
        </TimelineNode>

        <TimelineNode left={false} icon={ShoppingBag}>
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-[24px] shadow-sm border border-[#BFE0F2]/50 text-right">
            <h3 className="text-[22px] font-bold mb-2 flex items-center gap-3 justify-end text-[#5FA8D3]">
              سوبر ماركت <ShoppingBag className="w-6 h-6 md:hidden" />
            </h3>
            <p className="text-[#22323F]/70 text-[15px]">مسواك البيت خلص؟ خضراوات، فواكه، مواد غذائية، كلها نجيبها إلك.</p>
          </div>
        </TimelineNode>

        <TimelineNode left={true} icon={Gift}>
          <div className="bg-white/70 backdrop-blur-md p-6 rounded-[24px] shadow-sm border border-[#BFE0F2]/50 text-right md:text-left">
            <h3 className="text-[22px] font-bold mb-2 flex items-center gap-3 md:justify-start justify-end text-[#5FA8D3]">
              هدايا ومستلزمات <Gift className="w-6 h-6 md:hidden" />
            </h3>
            <p className="text-[#22323F]/70 text-[15px]">ملابس، كوزمتك، هدايا... من الصيدلية للهدية كلشي بطلب واحد!</p>
          </div>
        </TimelineNode>

        {/* Save Contact Section integrated into timeline */}
        <TimelineNode left={false} icon={Phone}>
          <div className="bg-[#5FA8D3] text-white p-8 rounded-[32px] shadow-xl text-center md:text-right overflow-hidden relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white blur-[80px] opacity-20 rounded-full" />
            <h2 className="text-[26px] font-bold mb-3 relative z-10">أهم شي... اخزن رقمنا!</h2>
            <p className="text-white/80 text-[16px] mb-6 relative z-10">
              تخيل تحتاج شي ضروري بنص الليل؟ احفظ رقمنا بجهازك واسمنا "أبو الأكبر للتوصيل" واتصل بينا بأي وقت.
            </p>
            {/* The tel: link opens dialer on phone natively */}
            <a href="tel:+9647733921468" className="inline-flex items-center gap-3 bg-white text-[#5FA8D3] px-6 py-4 rounded-full font-bold text-[16px] hover:bg-gray-50 transition-colors shadow-md relative z-10 mx-auto md:mx-0">
              <Phone className="w-5 h-5" />
              اتصل بنا أو احفظ الرقم
            </a>
          </div>
        </TimelineNode>

        {/* B2B Section */}
        <TimelineNode left={true} icon={Store}>
          <div className="bg-[#22323F] text-white p-8 rounded-[32px] shadow-2xl text-right md:text-left">
            <h2 className="text-[26px] font-bold mb-6 flex items-center gap-3 md:justify-start justify-end">
              عندك بيج أو محل؟ <Zap className="w-7 h-7 text-[#5FA8D3]" />
            </h2>
            <div className="space-y-4 text-white/80 text-[14px]">
              <div className="flex items-start gap-3 md:flex-row-reverse">
                <Banknote className="w-5 h-5 text-[#5FA8D3] mt-1 shrink-0" />
                <p><strong>دفع عند الاستلام:</strong> ندفعلك الحساب كاش مقدماً قبل ما نوصل طلبك للزبون!</p>
              </div>
              <div className="flex items-start gap-3 md:flex-row-reverse">
                <RotateCcw className="w-5 h-5 text-[#5FA8D3] mt-1 shrink-0" />
                <p><strong>راجع مجاني:</strong> اذا الزبون مارد الطلب، يرجعلك ببلاش.</p>
              </div>
              <div className="flex items-start gap-3 md:flex-row-reverse">
                <Smartphone className="w-5 h-5 text-[#5FA8D3] mt-1 shrink-0" />
                <p><strong>بدون برامج:</strong> التعامل كله بالواتساب بصمة أو رسالة، مادوخك.</p>
              </div>
            </div>
          </div>
        </TimelineNode>

        {/* Pricing List */}
        <TimelineNode left={false} icon={Banknote}>
          <div className="w-full">
            <h2 className="text-[26px] font-bold text-[#22323F] mb-6 text-right">قائمة أسعار التوصيل</h2>
            <div className="space-y-6">
              {/* 3000 IQD */}
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-emerald-100 text-right">
                <div className="flex justify-between items-center mb-4 flex-row-reverse">
                  <div>
                    <h3 className="font-bold text-[22px] text-[#22323F]">3,000 دينار</h3>
                    <span className="text-emerald-500 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full mt-1 inline-block">مناطق المركز</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <MapPin className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {regions3k.map(m => (
                    <span key={m} className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded text-[13px]">{m}</span>
                  ))}
                </div>
              </div>

              {/* 5000 IQD */}
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#BFE0F2]/50 text-right">
                <div className="flex justify-between items-center mb-4 flex-row-reverse">
                  <div>
                    <h3 className="font-bold text-[22px] text-[#22323F]">5,000 دينار</h3>
                    <span className="text-[#5FA8D3] text-sm font-bold bg-[#BFE0F2]/30 px-3 py-1 rounded-full mt-1 inline-block">الأطراف والأقضية</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#BFE0F2]/30 flex items-center justify-center text-[#5FA8D3]">
                    <Car className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {regions5k.map(m => (
                    <span key={m} className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded text-[13px]">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TimelineNode>

        {/* Social Links */}
        <TimelineNode left={true} icon={Users}>
          <div className="bg-[#E7F2FA] rounded-[32px] p-8 text-center shadow-inner">
            <h2 className="text-[22px] font-bold text-[#22323F] mb-6">تابعنا وتواصل ويانا</h2>
            <div className="flex flex-col gap-4">
              <a href="https://wa.me/9647733921468" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-green-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-green-600 transition-colors shadow-lg">
                <MessageCircle className="w-6 h-6" />
                واتساب الشركة
              </a>
              <a href="https://instagram.com/k.o_kseb" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-gradient-to-tr from-pink-500 to-purple-500 text-white px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg">
                <Camera className="w-6 h-6" />
                انستغرام
              </a>
              <a href="https://t.me/your_telegram_channel" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-blue-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-600 transition-colors shadow-lg">
                <Send className="w-6 h-6" />
                قناة التليكرام
              </a>
            </div>
          </div>
        </TimelineNode>

        {/* Final Store Button */}
        <TimelineNode left={false} icon={ShoppingCart}>
          <div className="text-center">
             <Link href="/store" className="inline-flex items-center justify-center gap-3 bg-[#22323F] text-white px-8 py-6 rounded-[28px] font-bold text-[20px] hover:bg-[#1a2530] transition-colors shadow-xl w-full">
               <ShoppingCart className="w-7 h-7" />
               ادخل للمتجر الإلكتروني الآن
             </Link>
          </div>
        </TimelineNode>

      </div>
    </div>
  );
}
