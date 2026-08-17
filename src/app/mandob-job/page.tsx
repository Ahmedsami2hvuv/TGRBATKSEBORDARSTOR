"use client";

import React, { useState } from "react";
import { submitJobApplication } from "@/app/actions/job-applications";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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
  Phone,
  Car
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    region: "",
    phone: "",
    carType: "",
    hasAc: false,
    hasCommitment: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await submitJobApplication(formData);
      if (res.success) {
        const waText = `مرحبا
اني ${formData.name}
من منطقة ${formData.region}
رقمي ${formData.phone}
سيارتي نوع ${formData.carType}
${formData.hasAc ? "بيها تبريد" : "ما بيها تبريد"}
${formData.hasCommitment ? "عندي التزام بوقت" : "ما عندي التزام"}

إجيتك من إعلان طلب مندوب التوصيل 🚗

أني قريت كل التفاصيل والشروط 📋

وتنطبق عليّ كل الشروط ✅

وأني متفرغ وما عندي أي التزام ثاني، 

وأكدر أشتغل وياكم صبح وعصر ⏰

خلي رقمي يمك في حال احتاجيت مندوب`;
        const encodedUrl = `https://wa.me/9647733921468?text=${encodeURIComponent(waText)}`;
        window.open(encodedUrl, "_blank");
        setIsModalOpen(false);
      } else {
        alert("حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الإرسال.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

            <div className="mt-6 p-4 rounded-xl bg-orange-50 border border-orange-100 text-orange-800 font-medium text-[15px] flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 shrink-0 text-orange-500 mt-0.5" />
              <p>ملاحظة: الأوقات المذكورة أعلاه هي <span className="font-bold">أوقات استلام الطلبات</span>، وليست أوقات انتهاء العمل وتوصيلها.</p>
            </div>

            <div className="mt-4 flex items-center gap-3 bg-gray-50 p-4 rounded-xl text-gray-700 font-medium border border-gray-200">
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
                <MapPin className="w-6 h-6 text-[#5FA8D3] shrink-0"/> 
                <div>
                  <h4 className="font-bold text-[17px]">من أهالي أبي الخصيب (حصراً)</h4>
                  <p className="text-[15px] text-gray-600 mt-1">يجب أن يكون المندوب من سكنة قضاء أبي الخصيب حصراً.</p>
                </div>
              </div>

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

              <div className="flex items-center gap-4 text-[#22323F] font-medium bg-white/60 p-5 rounded-2xl">
                <Car className="w-6 h-6 text-[#5FA8D3] shrink-0"/> 
                <div>
                  <h4 className="font-bold text-[17px]">امتلاك سيارة (حصراً)</h4>
                  <p className="text-[15px] text-gray-600 mt-1">يجب أن يمتلك المندوب سيارة (وليست دراجة)، ويُشترط أن يكون فيها تبريد شغال لبعض الطلبات التي تحتاجه.</p>
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
              <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 py-5 rounded-full font-bold text-[18px] hover:bg-[#20bd5a] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
                <MessageCircle className="w-6 h-6" />
                تواصل معنا لتقديم طلب
              </button>
              <a href="tel:+9647733921468" className="flex items-center justify-center gap-3 bg-white text-[#22323F] border-2 border-gray-200 px-8 py-5 rounded-full font-bold text-[18px] hover:bg-gray-50 transition-colors shadow-sm hover:shadow-md hover:-translate-y-1 duration-300">
                <Phone className="w-6 h-6" />
                07733921468
              </a>
            </div>
          </div>
        </FadeInSection>

      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="bg-[#5FA8D3] p-6 text-white flex justify-between items-center relative overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
                <h3 className="text-xl font-bold relative z-10 flex items-center gap-2">
                  <UserCheck className="w-6 h-6" />
                  تقديم طلب مندوب توصيل
                </h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="relative z-10 p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 overflow-y-auto">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الثلاثي</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all" placeholder="اكتب اسمك الكامل" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">العنوان / المنطقة</label>
                  <input required type="text" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all" placeholder="مثال: أبي الخصيب - محيلة" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف (الواتساب)</label>
                  <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all text-right" placeholder="077..." dir="ltr" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع السيارة</label>
                  <input required type="text" value={formData.carType} onChange={e => setFormData({...formData, carType: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all" placeholder="مثال: سايبا، إلنترا..." />
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input type="checkbox" id="hasAc" checked={formData.hasAc} onChange={e => setFormData({...formData, hasAc: e.target.checked})} className="w-5 h-5 rounded text-[#5FA8D3] focus:ring-[#5FA8D3]" />
                  <label htmlFor="hasAc" className="font-bold text-gray-700 cursor-pointer select-none">السيارة تحتوي على تبريد شغال</label>
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input type="checkbox" id="hasCommitment" checked={formData.hasCommitment} onChange={e => setFormData({...formData, hasCommitment: e.target.checked})} className="w-5 h-5 rounded text-[#5FA8D3] focus:ring-[#5FA8D3]" />
                  <label htmlFor="hasCommitment" className="font-bold text-gray-700 cursor-pointer select-none">عندي التزام بوقت معين (وظيفة أخرى أو دراسة)</label>
                </div>
                
                <button disabled={isSubmitting} type="submit" className="w-full bg-[#5FA8D3] hover:bg-[#4a8eb9] text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex justify-center items-center gap-2 mt-4">
                  {isSubmitting ? "جاري الإرسال..." : (
                    <>
                      <MessageCircle className="w-5 h-5" />
                      إرسال الطلب عبر الواتساب
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
