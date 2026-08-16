"use client";

import React, { useEffect, useState } from "react";
import { getSocialLinksAction, SocialLinksConfig } from "@/lib/social-links";
import ScrollytellingHero from "@/components/scrollytelling-hero";
import { motion } from "framer-motion";
import {
  Store, MessageCircle, Send, Users, Heart, Zap, MapPin, CheckCheck, Camera, Mic, Phone, Car, Clock, RotateCcw, Megaphone, Smartphone, ExternalLink, ArrowLeftRight, Banknote, ShoppingCart, UserPlus, Save
} from "lucide-react";
import Link from "next/link";

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

export default function WelcomePage() {
  const [links, setLinks] = useState<SocialLinksConfig | null>(null);

  useEffect(() => {
    getSocialLinksAction().then(data => setLinks(data));
  }, []);

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? "https://www.youtube.com/embed/" + match[2] : null;
  };

  const videoUrl = getYouTubeEmbedUrl(links?.promoVideoUrl);

  // vCard format for saving contact
  const vCardData = "BEGIN:VCARD\nVERSION:3.0\nN:;أبو الأكبر للتوصيل;;;\nFN:أبو الأكبر للتوصيل\nTEL;TYPE=CELL:+9647733921468\nORG:أبو الأكبر للتوصيل الشامل\nEND:VCARD";
  const vCardUrl = "data:text/vcard;charset=utf-8," + encodeURIComponent(vCardData);

  return (
    <div className="min-h-screen bg-[#F6FAFD] text-[#22323F] font-['IBM_Plex_Sans_Arabic'] overflow-x-hidden selection:bg-[#BFE0F2] selection:text-[#22323F]">
      
      {/* 1. السرد القصصي (Scrollytelling) بالبداية */}
      <ScrollytellingHero />

      {/* 2. تكملة الصفحة بحركات تفاعلية (Scroll Magic) */}
      <div className="max-w-4xl mx-auto px-4 pb-24 relative z-10 -mt-[10vh]">
        
        {/* زر حفظ الرقم بحركة ملفتة */}
        <FadeInSection>
          <div className="bg-white/70 backdrop-blur-xl rounded-[32px] p-8 md:p-12 text-center shadow-[0_10px_40px_rgba(95,168,211,0.12),inset_0_0_0_1px_rgba(191,224,242,0.6)] mb-12 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#5FA8D3]/5 to-transparent pointer-events-none" />
            <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ repeat: Infinity, duration: 2.5 }} className="w-16 h-16 bg-[#5FA8D3] rounded-full mx-auto flex items-center justify-center mb-6 shadow-[0_8px_20px_rgba(95,168,211,0.3)] text-white">
              <Save className="w-7 h-7" />
            </motion.div>
            <h2 className="text-[26px] md:text-[32px] font-bold mb-4 text-[#22323F]">أهم شي... اخزن رقمنا!</h2>
            <p className="text-[16px] md:text-[18px] text-[#22323F]/70 mb-8 max-w-lg mx-auto">
              تخيل تحتاج شي ضروري بنص الليل؟ رقمنا لازم يكون بجهازك واسمنا "أبو الأكبر للتوصيل" 🛵
            </p>
            <a href={vCardUrl} download="Abu_Alakbar.vcf" className="inline-flex items-center gap-3 bg-[#5FA8D3] text-white px-8 py-4 rounded-full font-bold text-[18px] hover:bg-[#4a8eb9] transition-colors shadow-lg hover:shadow-xl active:scale-95 duration-200">
              <UserPlus className="w-5 h-5" />
              اضغط هنا لحفظ الرقم في جهات الاتصال
            </a>
          </div>
        </FadeInSection>

        {/* أقسام التوصيل */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <FadeInSection delay={0.1}>
            <div className="bg-white/60 backdrop-blur-md rounded-[28px] p-8 shadow-sm border border-[#BFE0F2]/50 hover:bg-white/80 transition-all h-full">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-500 mb-6">
                <Store className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">شنو نوصلك؟ كلشي!</h3>
              <p className="text-[#22323F]/70 leading-relaxed">
                ملابس، أحذية، كوزمتك، هدايا، إكسسوارات، حلويات، ورد، أدوية صيدلية، سوبر ماركت، خضراوات، وتجهيزات غذائية... حرفياً أي شي ببالك يجيك للباب.
              </p>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <div className="bg-white/60 backdrop-blur-md rounded-[28px] p-8 shadow-sm border border-[#BFE0F2]/50 hover:bg-white/80 transition-all h-full">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-500 mb-6">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">ميزات خيالية للزبائن</h3>
              <ul className="text-[#22323F]/70 space-y-3">
                <li className="flex items-center gap-2"><CheckCheck className="w-5 h-5 text-green-500 shrink-0"/> توصيل سريع وآمن</li>
                <li className="flex items-center gap-2"><CheckCheck className="w-5 h-5 text-green-500 shrink-0"/> استبدال مجاني من باب البيت</li>
                <li className="flex items-center gap-2"><CheckCheck className="w-5 h-5 text-green-500 shrink-0"/> إرسال واستلام الطلبات الشخصية</li>
              </ul>
            </div>
          </FadeInSection>
        </div>

        {/* قسم البائعين وأصحاب المتاجر */}
        <FadeInSection>
          <div className="bg-[#22323F] text-white rounded-[32px] p-8 md:p-12 mb-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#5FA8D3] blur-[120px] rounded-full opacity-20 pointer-events-none" />
            <h2 className="text-[28px] md:text-[34px] font-bold mb-8 flex items-center gap-4">
              <Zap className="w-8 h-8 text-[#5FA8D3]" />
              عندك بيج أو محل؟ (B2B)
            </h2>
            <div className="grid sm:grid-cols-2 gap-y-6 gap-x-8 text-white/80">
              <div className="flex gap-4">
                <Banknote className="w-6 h-6 text-[#5FA8D3] shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1">دفع عند الاستلام</h4>
                  <p className="text-sm">ندفعلك الحساب كاش مقدماً قبل ما نوصل طلبك للزبون!</p>
                </div>
              </div>
              <div className="flex gap-4">
                <RotateCcw className="w-6 h-6 text-[#5FA8D3] shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1">راجع مجاني</h4>
                  <p className="text-sm">اذا الزبون مارد الطلب، يرجعلك ببلاش بدون أي كلفة.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Smartphone className="w-6 h-6 text-[#5FA8D3] shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1">بدون برامج</h4>
                  <p className="text-sm">التعامل كله بالواتساب بصمة أو رسالة، مادوخك ببرامج معقدة.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <ArrowLeftRight className="w-6 h-6 text-[#5FA8D3] shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1">تغيير القياس مجاناً</h4>
                  <p className="text-sm">خدمة تبديل القياس للزبون مجانية من باب بيته.</p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* الأسعار بشكل جميل وجديد */}
        <FadeInSection>
          <div className="mb-16">
            <div className="text-center mb-10">
              <h2 className="text-[28px] md:text-[32px] font-bold text-[#22323F] mb-4">قائمة أسعار التوصيل</h2>
              <p className="text-[#22323F]/60">أسعارنا ثابتة ومناسبة لجميع مناطق كربلاء</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              {/* 3000 IQD */}
              <div className="flex-1 bg-white rounded-[28px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-emerald-400 blur-[80px] rounded-full opacity-20" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[22px] text-[#22323F]">3,000 دينار</h3>
                    <span className="text-emerald-500 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full mt-2 inline-block">مناطق المركز</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <MapPin className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['العسكري', 'حي الحسين', 'المعلمين', 'النقيب', 'البلدية', 'الملحق', 'الإسكان', 'حي رمضان', 'البناء الجاهز', 'حي العباس', 'الحي الصناعي', 'الجاير'].map(m => (
                    <span key={m} className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm">{m}</span>
                  ))}
                </div>
              </div>

              {/* 5000 IQD */}
              <div className="flex-1 bg-white rounded-[28px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-[#5FA8D3] blur-[80px] rounded-full opacity-20" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[22px] text-[#22323F]">5,000 دينار</h3>
                    <span className="text-[#5FA8D3] text-sm font-bold bg-[#BFE0F2]/30 px-3 py-1 rounded-full mt-2 inline-block">الأطراف والأقضية</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#BFE0F2]/30 flex items-center justify-center text-[#5FA8D3]">
                    <Car className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['الحر', 'طويريج', 'الجدول الغربي', 'الحسينية', 'العطيشي'].map(m => (
                    <span key={m} className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* وسائل التواصل - شكل أحدث */}
        <FadeInSection>
          <div className="text-center bg-[#E7F2FA] rounded-[32px] p-8 md:p-12 mb-12 shadow-inner">
            <h2 className="text-[24px] font-bold text-[#22323F] mb-8">تابعنا وتواصل ويانا</h2>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="https://wa.me/9647733921468" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-green-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20">
                <MessageCircle className="w-6 h-6" />
                واتساب الشركة
              </a>
              <a href="https://instagram.com/k.o_kseb" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-gradient-to-tr from-pink-500 to-purple-500 text-white px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-pink-500/20">
                <Camera className="w-6 h-6" />
                انستغرام
              </a>
              <a href="https://t.me/your_telegram_channel" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-blue-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
                <Send className="w-6 h-6" />
                قناة التليكرام
              </a>
            </div>
            
            <div className="mt-8 flex justify-center gap-4 flex-wrap">
              <a href="https://chat.whatsapp.com/your_group_link" target="_blank" rel="noreferrer" className="text-sm font-medium text-[#22323F]/70 hover:text-[#5FA8D3] flex items-center gap-1 bg-white/50 px-4 py-2 rounded-full">
                <Users className="w-4 h-4" /> قروب الواتساب المختلط
              </a>
              <a href="https://t.me/your_telegram_group" target="_blank" rel="noreferrer" className="text-sm font-medium text-[#22323F]/70 hover:text-[#5FA8D3] flex items-center gap-1 bg-white/50 px-4 py-2 rounded-full">
                <Users className="w-4 h-4" /> قروب التليكرام
              </a>
            </div>
          </div>
        </FadeInSection>
        
        {/* زر متجر النظام الفعلي */}
        <FadeInSection delay={0.2}>
          <div className="text-center">
             <Link href="/store" className="inline-flex items-center justify-center gap-2 bg-[#22323F] text-white px-10 py-5 rounded-full font-bold text-xl hover:bg-[#1a2530] transition-colors shadow-xl hover:shadow-2xl hover:-translate-y-1 duration-300">
               <ShoppingCart className="w-6 h-6" />
               ادخل للمتجر الإلكتروني الآن
             </Link>
          </div>
        </FadeInSection>

      </div>
    </div>
  );
}
