"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Package,
  Banknote,
  MapPin,
  Store,
  Clock,
  Coffee,
  Sun,
  Sunset,
  UserCheck,
  Map,
  HeartHandshake,
  AlertTriangle,
  MessageCircle,
  Phone
} from "lucide-react";

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

export default function MandobJobPage() {
  return (
    <div className="min-h-screen bg-[#F6FAFD] text-[#22323F] font-['IBM_Plex_Sans_Arabic'] selection:bg-[#BFE0F2] selection:text-[#22323F] pb-24" dir="rtl">
      
      {/* Header Section */}
      <div className="bg-[#5FA8D3] text-white pt-16 pb-24 px-4 relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white blur-[100px] opacity-20 rounded-full" />
        <div className="absolute bottom-[-50px] left-[-50px] w-64 h-64 bg-[#22323F] blur-[100px] opacity-10 rounded-full" />
        
        <div className="max-w-4xl mx-auto relative z-10 text-center mt-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-6 backdrop-blur-sm">
              <Package className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              إعلان وظيفة: مندوب توصيل
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              بخدمة أبو الاكبر للتوصيل
            </p>
            <p className="text-lg md:text-xl text-white/80 mt-4 max-w-2xl mx-auto leading-relaxed">
              حيا الله الشباب، الي ديستفسرون عن تفاصيل الشغل، هذا شرح كامل لطبيعة العمل والأجور وأوقات الدوام والشروط 👇
            </p>
          </motion.div>
        </div>
        
        {/* Curved shape at the bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-auto text-[#F6FAFD]" fill="currentColor" preserveAspectRatio="none">
            <path d="M0,120 L1440,120 L1440,60 C1440,60 1080,120 720,120 C360,120 0,60 0,60 Z"></path>
          </svg>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 relative z-10 -mt-8">
        
        {/* طبيعة الشغل */}
        <FadeInSection>
          <div className="bg-white rounded-[32px] p-8 md:p-10 mb-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
            <h2 className="text-[24px] md:text-[28px] font-bold mb-6 flex items-center gap-3 text-[#22323F]">
              <Package className="w-8 h-8 text-[#5FA8D3]" />
              طبيعة الشغل
            </h2>
            <p className="text-[16px] md:text-[18px] text-gray-700 leading-relaxed font-medium">
              استلام وتسليم الطلبات من المحلات، البيجات المنزلية، وأصحاب المشاريع بالبيوت 
              <span className="block mt-2 text-gray-500 text-[15px]">
                (مثل: طلبات أمازون، أهل الكيك، المطابخ، والمحلات التجارية).
              </span>
            </p>
          </div>
        </FadeInSection>

        {/* أجور التوصيل */}
        <FadeInSection>
          <div className="bg-[#22323F] text-white rounded-[32px] p-8 md:p-10 mb-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[200px] h-[200px] bg-green-500 blur-[100px] rounded-full opacity-10 pointer-events-none" />
            <h2 className="text-[24px] md:text-[28px] font-bold mb-8 flex items-center gap-3 text-green-400">
              <Banknote className="w-8 h-8" />
              أجور التوصيل (الكروة للمندوب)
            </h2>
            
            <div className="space-y-6">
              <div className="flex gap-4 items-start bg-white/5 p-5 rounded-2xl border border-white/10">
                <MapPin className="w-6 h-6 text-green-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-[18px] mb-2 text-green-300">من الأسمدة لـ محيلة</h4>
                  <p className="text-[20px] font-bold text-white">2,000 دينار <span className="text-[15px] font-normal text-white/70">لكل الطلبيات</span></p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-white/5 p-5 rounded-2xl border border-white/10">
                <MapPin className="w-6 h-6 text-green-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-[18px] mb-2 text-green-300">من سيطرة محيلة لـ السراجي</h4>
                  <p className="text-[20px] font-bold text-white">3,300 دينار <span className="text-[15px] font-normal text-white/70">لكل الطلبيات</span></p>
                </div>
              </div>

              <div className="flex gap-4 items-start bg-white/5 p-5 rounded-2xl border border-white/10">
                <Store className="w-6 h-6 text-orange-400 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-[18px] mb-2 text-orange-400">طلبيات السوق (ميزة مريحة)</h4>
                  <p className="text-[15px] leading-relaxed text-white/90">
                    المندوب ما يحتاج ينزل بنفسه ويتأذى من دخلة السوق وبصعوبة يلكاله مكان أو المرور يغرمه؛ هالشي متعب. 
                    <br/><br/>
                    <span className="text-green-300 font-bold">فإحنا عدنا موظف جوة بالسوق</span> يستلم الطلبيات ويطلعهن إلك خارج السوق، وتستلمهن وأنت مرتاح.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* أوقات الدوام */}
        <FadeInSection>
          <div className="bg-white rounded-[32px] p-8 md:p-10 mb-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100">
            <h2 className="text-[24px] md:text-[28px] font-bold mb-8 flex items-center gap-3 text-[#22323F]">
              <Clock className="w-8 h-8 text-[#5FA8D3]" />
              أوقات الدوام (شفتين)
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-20 h-20 bg-blue-200 blur-[30px] rounded-full opacity-50" />
                <Sun className="w-8 h-8 text-blue-500 mb-4" />
                <h4 className="font-bold text-[18px] mb-2 text-[#22323F]">الشفت الأول</h4>
                <p className="text-gray-600 font-medium text-[16px]">من الساعة 8:00 صباحاً<br/>لحد الساعة 12:00 ظهراً.</p>
              </div>

              <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-20 h-20 bg-orange-200 blur-[30px] rounded-full opacity-50" />
                <Sunset className="w-8 h-8 text-orange-500 mb-4" />
                <h4 className="font-bold text-[18px] mb-2 text-[#22323F]">الشفت الثاني</h4>
                <p className="text-gray-600 font-medium text-[16px]">من الساعة 4:00 عصراً<br/>لحد الساعة 8:00 مساءً.</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 bg-gray-50 p-4 rounded-xl text-gray-700 font-medium border border-gray-200">
              <Coffee className="w-6 h-6 text-[#5FA8D3]" />
              <p>فترة استراحة بين الشفتين لمدة <span className="font-bold text-[#22323F]">4 ساعات</span>.</p>
            </div>
          </div>
        </FadeInSection>

        {/* المطلوب */}
        <FadeInSection>
          <div className="bg-[#E7F2FA] rounded-[32px] p-8 md:p-10 mb-8 shadow-inner">
            <h2 className="text-[24px] md:text-[28px] font-bold text-[#5FA8D3] mb-6 flex items-center gap-3">
              <UserCheck className="w-8 h-8" />
              المطلوب من المندوب
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-[#22323F] font-medium bg-white/60 p-5 rounded-2xl">
                <Clock className="w-6 h-6 text-[#5FA8D3] shrink-0"/> 
                <div>
                  <h4 className="font-bold text-[17px]">التفرغ التام</h4>
                  <p className="text-[15px] text-gray-600 mt-1">أن يكون المندوب متفرغاً تماماً وليس لديه أي التزام عمل آخر.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-[#22323F] font-medium bg-white/60 p-5 rounded-2xl">
                <Map className="w-6 h-6 text-[#5FA8D3] shrink-0"/> 
                <div>
                  <h4 className="font-bold text-[17px]">استخدام الخرائط</h4>
                  <p className="text-[15px] text-gray-600 mt-1">أن يكون المندوب يعرف يشتغل على خرائط كوكل (Google Maps).</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[#22323F] font-medium bg-white/60 p-5 rounded-2xl">
                <HeartHandshake className="w-6 h-6 text-[#5FA8D3] shrink-0"/> 
                <div>
                  <h4 className="font-bold text-[17px]">الأخلاق والتعامل</h4>
                  <p className="text-[15px] text-gray-600 mt-1">أن يكون ذو خلق وتعامـل عالي ومحترم مع الناس.</p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* ملاحظة مهمة */}
        <FadeInSection>
          <div className="bg-red-50 rounded-[32px] p-8 md:p-10 mb-12 border-2 border-red-100">
            <h2 className="text-[22px] md:text-[24px] font-bold text-red-600 mb-4 flex items-center gap-3">
              <AlertTriangle className="w-7 h-7" />
              ملاحظة مهمة جداً ⚠️
            </h2>
            <p className="text-[16px] md:text-[18px] text-red-900 leading-relaxed font-medium">
              الطلبيات البعيدة ما يطلع بيها المندوب مباشرةً، بل ينتظر لحد وقت "التعزيلة" حتى ما تفوتنا الطلبيات القريبة، وأيضاً حتى يجمع أكبر قدر من الطلبات البعيدة وياخذها مرة وحدة.
            </p>
          </div>
        </FadeInSection>

        {/* التواصل */}
        <FadeInSection>
          <div className="text-center">
            <h3 className="text-[22px] font-bold text-[#22323F] mb-6">مهتم بالوظيفة وتنطبق عليك الشروط؟</h3>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <a href="https://wa.me/9647733921468" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 py-5 rounded-full font-bold text-[18px] hover:bg-[#20bd5a] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
                <MessageCircle className="w-6 h-6" />
                تواصل معنا على واتساب
              </a>
              <a href="tel:+9647733921468" className="flex items-center justify-center gap-3 bg-white text-[#22323F] border-2 border-gray-200 px-8 py-5 rounded-full font-bold text-[18px] hover:bg-gray-50 transition-colors shadow-sm hover:shadow-md hover:-translate-y-1 duration-300">
                <Phone className="w-6 h-6" />
                07733921468
              </a>
            </div>
          </div>
        </FadeInSection>

      </div>
    </div>
  );
}
