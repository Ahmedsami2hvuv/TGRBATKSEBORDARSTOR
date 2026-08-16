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

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? "https://www.youtube.com/embed/" + match[2] : null;
  };

  const videoUrl = getYouTubeEmbedUrl(links?.promoVideoUrl) || "https://www.youtube.com/embed/DA4ewcyRhBo";

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
              <Phone className="w-7 h-7" />
            </motion.div>
            <h2 className="text-[26px] md:text-[32px] font-bold mb-4 text-[#22323F] leading-snug">السلام عليكم 👋<br/>قبل كل شي وأهم شي... اخزن رقمنا!</h2>
            <p className="text-[16px] md:text-[18px] text-[#22323F]/80 mb-8 max-w-xl mx-auto leading-relaxed">
              اخزن رقمنا باسم "أبو الأكبر للتوصيل"، ووراها كمل قراءة الرسالة. إذا خزنته، تعال اسولفلك...<br/><br/>
              ليش لازم تخزن رقمنا ونخزن رقمك؟ لأن إحنا ننشر يومياً منتجات من شتى المحلات لا على التعيين، فاخزن رقمنا ولازم نخزن رقمك حتى تشوف الحالات.
            </p>
            <a href="tel:+9647733921468" className="inline-flex flex-col md:flex-row items-center gap-3 bg-[#5FA8D3] text-white px-8 py-4 rounded-full font-bold text-[18px] hover:bg-[#4a8eb9] transition-colors shadow-lg hover:shadow-xl active:scale-95 duration-200">
              <Phone className="w-5 h-5" />
              اتصل بنا أو احفظ الرقم
              <span className="text-sm opacity-90" dir="ltr">0773 392 1468</span>
            </a>
          </div>
        </FadeInSection>

        {/* قسم شنو نوصلك بالتفصيل */}
        <FadeInSection>
          <div className="bg-white/60 backdrop-blur-md rounded-[32px] p-8 md:p-12 shadow-sm border border-[#BFE0F2]/50 mb-12">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-500 mb-6">
              <Store className="w-8 h-8" />
            </div>
            <h3 className="text-[24px] font-bold mb-4">يعني شنو نوصلك؟ (أي شي!)</h3>
            <p className="text-[#22323F]/80 leading-loose text-[16px] md:text-[18px]">
              <strong className="text-[#5FA8D3]">مثلاً تكدر تطلب:</strong> أدوية، مخضر (خضروات وفواكه)، خبز، صمون، كيك ومعجنات بأنواعها، كبة وميني بيتزا، لحم بعجين، أجبان وألبان، حليب، دجاج ذبح أو شوي، سمك شوي، طرشي، بهارات، لحم، مواد تجميل وكل مواد الكوزمتك، كرزات، إنشائية، كهربائيات، قرطاسية، هدايا وكل أشياء الطباعة، ألعاب، ملابس (من مجمع النور أو ضرار أو غيرهم)، أحذية، شحاطات، هيدفون، شاحنة، مفروشات، مواد من أنسب الأسعار، ذهب، مواد غذائية، مواد من الجملة، أقراص ألعاب، معسل أركيلة وفحم وكل مستلزماتها، أكل، لفات، بانزين، ودهن محركات.
              <br/><br/>
              نودي ونجيب فلوس من مكان لمكان... يعني كل شي يصير بين إيديك وين ما كنت بأبو الخصيب!
            </p>
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
            <p className="text-[#22323F]/80 mb-8 text-[18px]">الي من خلاله المحلات والبيجات يرفعون طلبياتهم (موقع لطلباتكم يغنيك عن تحميل التطبيقات وغيرها):</p>
            
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

        {/* المتجر وفيديو اليوتيوب */}
        <FadeInSection>
          <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-xl border border-gray-100 text-center mb-12">
            <h3 className="text-[26px] font-bold mb-4">بالإضافة... عدنة متجر تسوق شامل لأهالي أبي الخصيب</h3>
            <p className="text-[#22323F]/80 mb-8 text-[18px]">شاهد طريقة التسوق من الموقع بالفيديو التالي:</p>
            {videoUrl && (
              <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100 mb-8 bg-black">
                <iframe
                  className="w-full aspect-video"
                  src={videoUrl}
                  title="طريقة التسوق"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            <Link href="/store" className="inline-flex items-center justify-center gap-3 bg-[#5FA8D3] text-white px-10 py-5 rounded-full font-bold text-[20px] hover:bg-[#4a8eb9] transition-colors w-full shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
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
                واتساب الشركة
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
