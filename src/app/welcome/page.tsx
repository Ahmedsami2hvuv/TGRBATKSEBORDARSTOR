"use client";

import React, { useEffect, useState } from "react";
import { getSocialLinksAction, SocialLinksConfig } from "@/lib/social-links";
import ScrollytellingHero from "@/components/scrollytelling-hero";
import { motion } from "framer-motion";
import {
  Store, MessageCircle, Send, Users, Heart, Zap, MapPin, CheckCheck, Camera, Mic, Phone, Car, Clock, RotateCcw, Megaphone, Smartphone, ExternalLink, ArrowLeftRight, Banknote, ShoppingCart, UserPlus, Save
} from "lucide-react";
import Link from "next/link";

const regions3k = ['الاسمدة', 'جيكور حزبه', 'جيكور', 'العصفورية', 'باب سليمان', 'باب طويل', 'باب العريض', 'باب عباس', 'كوت بازل', 'باب دباغ', 'باب ميدان', 'بلد سلطان', 'ام الصخر', 'باب رمانه', 'اهل عيد', 'الباني', 'نهر خوز', 'ابو مغيرة', 'مجيبرة', 'السبيليات', 'الصنگر', 'محيلة قبل دورة ام زباله', 'طريق الوسطي', 'العاگولية', 'الصحراء', 'ابو كوصرة', 'طريزاوية', 'العوجة', 'المقيمين', 'الابطاح', 'اللكطة', 'الشجرة الطيبة', 'شيخ ابراهيم', 'نزيلة', 'عميرية', 'بلد', 'كوت البلجاني', 'الحوطة', 'السوق', 'الصنكر', 'محيله الوسطي', 'محيله قرب الجسر', 'محيله بالسوق', 'محيله قرب السيطرة', 'محيله شارع المشروع'];

const regions5k = ['محيله شارع سيد حامد', 'محيله شارع الاندلس', 'محيله الصكاروة', 'المعهد الصناعي', 'دورة ام زباله بعد الاستدارة', 'الاندلس', 'طريق سيد حامد بعد الاندلس', 'الجديدة', 'الرومية', 'الصكاروة', 'كوت الصلحي', 'كوت الفداغ', 'جامع الشهيد', 'يوسفان', 'حمدان', 'كوت ثويني', 'البهادرية', 'محولة الزهير', 'كوت الحمداني', 'عويسيان', 'مهيجران', 'السراجي'];

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

  return (
    <div className="min-h-screen bg-[#F6FAFD] text-[#22323F] font-['IBM_Plex_Sans_Arabic'] overflow-x-hidden selection:bg-[#BFE0F2] selection:text-[#22323F]">
      
      {/* 1. السرد القصصي (Scrollytelling) بالبداية */}
      <ScrollytellingHero />

      {/* 2. تكملة الصفحة بحركات تفاعلية (Scroll Magic) */}
      <div className="max-w-4xl mx-auto px-4 pb-24 relative z-10 -mt-[10vh]">
        
        {/* زر حفظ الرقم بحركة ملفتة ومختصرة */}
        <FadeInSection>
          <div className="bg-[#5FA8D3] text-white rounded-[32px] p-8 md:p-10 text-center shadow-xl mb-12 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white blur-[80px] opacity-20 rounded-full" />
            <h2 className="text-[26px] md:text-[30px] font-bold mb-4 leading-snug">السلام عليكم 👋 أهم شي... اخزن رقمنا!</h2>
            <p className="text-[16px] md:text-[18px] text-white/90 mb-8 max-w-lg mx-auto leading-relaxed">
              تخيل تحتاج شي ضروري بنص الليل؟ رقمنا لازم يكون بجهازك واسمنا (أبو الأكبر للتوصيل). ننشر يومياً حالات لمنتجات من شتى المحلات، فاحفظ الرقم حتى توصلك أقوى العروض.
            </p>
            <a href="tel:+9647733921468" className="inline-flex items-center justify-center gap-3 bg-white text-[#5FA8D3] px-8 py-4 rounded-full font-bold text-[18px] hover:bg-gray-50 transition-colors shadow-lg active:scale-95 duration-200 w-full sm:w-auto">
              <Phone className="w-5 h-5" />
              احفظ الرقم (07733921468)
            </a>
          </div>
        </FadeInSection>

        {/* قسم البائعين وأصحاب المتاجر */}
        <FadeInSection>
          <div className="bg-[#22323F] text-white rounded-[32px] p-8 md:p-12 mb-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500 blur-[120px] rounded-full opacity-10 pointer-events-none" />
            <h2 className="text-[28px] md:text-[32px] font-bold mb-8 flex items-center gap-4 text-orange-400">
              <Zap className="w-8 h-8" />
              يا هلا بأصحاب المحلات! 🚚
            </h2>
            <p className="text-white/90 mb-8 font-medium text-[18px]">استمتعوا بمزايا التوصيل المتوفرة لدينا:</p>
            
            <div className="grid sm:grid-cols-2 gap-y-8 gap-x-8 text-white/80">
              <div className="flex gap-4">
                <Banknote className="w-7 h-7 text-orange-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1 text-[18px]">الدفع نقدًا 💵</h4>
                  <p className="text-[15px] leading-relaxed">يسلمكم المندوب الحساب قبل مغادرة المكان.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock className="w-7 h-7 text-orange-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1 text-[18px]">توصيل فوري 🚀</h4>
                  <p className="text-[15px] leading-relaxed">الصباحية تصل بالصباح🌅 والمسائية تصل العصر أو المغرب🌇. أقصى مدة للتأخير 3 ساعات في حال وجود مشكلة.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <CheckCheck className="w-7 h-7 text-orange-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1 text-[18px]">مواعيد ومندوبين 🕒</h4>
                  <p className="text-[15px] leading-relaxed">احترام موعد الاستلام والتسليم، ومندوبين مختارين بعناية ومدربين على أعلى مستوى 🤵‍♂️.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <RotateCcw className="w-7 h-7 text-orange-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-white mb-1 text-[18px]">مزايا أخرى 🔥</h4>
                  <p className="text-[15px] leading-relaxed">إعادة مجانية للطلبات المرفوضة، ترويج مجاني لحساباتكم، سيارات حديثة مكيفة 🚗 ودراجات نارية 🏍️.</p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* مميزات التطبيق الجديد */}
        <FadeInSection>
          <div className="bg-[#E7F2FA] rounded-[32px] p-8 md:p-12 mb-12 shadow-inner">
            <h2 className="text-[26px] font-bold text-[#5FA8D3] mb-4">🔥 مميزات جديدة بتطبيق الطلبات!</h2>
            <p className="text-[#22323F]/80 mb-8 text-[18px]">موقع لطلباتكم يغنيك عن تحميل التطبيقات وغيرها:</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-[16px]">
              <div className="flex items-center gap-3 text-[#22323F] font-medium bg-white/50 p-4 rounded-xl"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> بدون تحميل تطبيق 📵</div>
              <div className="flex items-center gap-3 text-[#22323F] font-medium bg-white/50 p-4 rounded-xl"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> بدون يوزر أو رقم سري 🔡</div>
              <div className="flex items-center gap-3 text-[#22323F] font-medium bg-white/50 p-4 rounded-xl"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> تسجيل بصمة صوت 🎤</div>
              <div className="flex items-center gap-3 text-[#22323F] font-medium bg-white/50 p-4 rounded-xl"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> التقاط صور للطلبية 📸</div>
              <div className="flex items-center gap-3 text-[#22323F] font-medium bg-white/50 p-4 rounded-xl"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> زر الطلب العكسي 🔄</div>
              <div className="flex items-center gap-3 text-[#22323F] font-medium bg-white/50 p-4 rounded-xl"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> زر كلشي واصل</div>
              <div className="flex items-center gap-3 text-[#22323F] font-medium bg-white/50 p-4 rounded-xl sm:col-span-2"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> اختيار نوع المركبة (سيارة أم دراجة 👌)</div>
            </div>
            
            <p className="text-[#22323F] font-bold text-[18px]">الآن يمكنك رفع طلبياتك بكل سهولة وسرعة! الموقع سيتعرف عليك مباشرة 🫵🏻.</p>
          </div>
        </FadeInSection>

        {/* الأسعار بشكل جميل وجديد */}
        <FadeInSection>
          <div className="mb-16">
            <div className="text-center mb-10">
              <h2 className="text-[28px] md:text-[32px] font-bold text-[#22323F] mb-4">علماً أن الأسعار للطلبية الواحدة ⭕</h2>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              {/* 3000 IQD */}
              <div className="flex-1 bg-white rounded-[28px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-emerald-100 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-emerald-400 blur-[80px] rounded-full opacity-20" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[26px] text-[#22323F]">3,000 دينار</h3>
                    <span className="text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full mt-2 inline-block">هذه المناطق على 3</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <MapPin className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {regions3k.map(m => (
                    <span key={m} className="px-2.5 py-1.5 bg-emerald-50/50 text-emerald-800 border border-emerald-100 rounded-lg text-sm font-medium">{m}</span>
                  ))}
                </div>
              </div>

              {/* 5000 IQD */}
              <div className="flex-1 bg-white rounded-[28px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-[#BFE0F2] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-[#5FA8D3] blur-[80px] rounded-full opacity-20" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-[26px] text-[#22323F]">5,000 دينار</h3>
                    <span className="text-[#5FA8D3] text-sm font-bold bg-[#BFE0F2]/30 px-3 py-1 rounded-full mt-2 inline-block">هذه المناطق على 5</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#BFE0F2]/30 flex items-center justify-center text-[#5FA8D3]">
                    <Car className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {regions5k.map(m => (
                    <span key={m} className="px-2.5 py-1.5 bg-[#F6FAFD] text-[#5FA8D3] border border-[#BFE0F2]/50 rounded-lg text-sm font-medium">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* المتجر بدون يوتيوب */}
        <FadeInSection>
          <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-xl border border-gray-100 text-center mb-12">
            <h3 className="text-[26px] font-bold mb-8">بالإضافة... عدنة متجر تسوق شامل لأهالي أبي الخصيب</h3>
            <Link href="/store" className="inline-flex items-center justify-center gap-3 bg-[#5FA8D3] text-white px-10 py-5 rounded-full font-bold text-[20px] hover:bg-[#4a8eb9] transition-colors w-full sm:w-auto shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
              <ShoppingCart className="w-7 h-7" />
              ادخل (لخصيبي ستور) الآن
            </Link>
          </div>
        </FadeInSection>

        {/* وسائل التواصل - شكل أحدث */}
        <FadeInSection>
          <div className="text-center bg-[#E7F2FA] rounded-[32px] p-8 md:p-12 mb-12 shadow-inner">
            <h2 className="text-[24px] font-bold text-[#22323F] mb-8">تابعنا وتواصل ويانا</h2>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="https://wa.me/9647733921468" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-green-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20">
                <MessageCircle className="w-6 h-6" />
                واتساب الخدمة
              </a>
              <a href="https://instagram.com/k.o_kseb" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-gradient-to-tr from-pink-500 to-purple-500 text-white px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-pink-500/20">
                <Camera className="w-6 h-6" />
                حساب الانستكرام
              </a>
              <a href="https://t.me/ko_kseb" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-blue-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">
                <Send className="w-6 h-6" />
                قناة التليكرام
              </a>
            </div>
            
            <div className="mt-8 flex justify-center gap-4 flex-wrap">
              <a href="https://chat.whatsapp.com/JSqEm7M1CgqBglStuRyItH" target="_blank" rel="noreferrer" className="text-[15px] font-bold text-[#22323F]/80 hover:text-[#5FA8D3] flex items-center gap-2 bg-white/70 px-5 py-3 rounded-xl shadow-sm">
                <Users className="w-5 h-5 text-[#128C7E]" /> أكبر كروب واتساب مختلط
              </a>
              <a href="https://t.me/+IIH_puHB8Mg2MDIy" target="_blank" rel="noreferrer" className="text-[15px] font-bold text-[#22323F]/80 hover:text-[#5FA8D3] flex items-center gap-2 bg-white/70 px-5 py-3 rounded-xl shadow-sm">
                <Users className="w-5 h-5 text-[#0088cc]" /> أكبر كروب تليكرام للبيع والشراء
              </a>
            </div>
          </div>
        </FadeInSection>
        
      </div>
    </div>
  );
}
