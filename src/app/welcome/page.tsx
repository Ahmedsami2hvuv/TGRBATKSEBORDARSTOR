"use client";
import React, { useEffect, useState } from "react";
import { getSocialLinksAction, SocialLinksConfig } from "@/lib/social-links";
import ScrollytellingHero from "@/components/scrollytelling-hero";
import { motion } from "framer-motion";
import {
  Store, MessageCircle, Send, Users, Heart, Zap, MapPin, CheckCheck, Camera, Mic, Phone, Car, Clock, RotateCcw, Megaphone, Smartphone, ExternalLink, ArrowLeftRight
} from "lucide-react";

export default function WelcomePage() {
  const [links, setLinks] = useState<SocialLinksConfig | null>(null);

  useEffect(() => {
    getSocialLinksAction().then(data => setLinks(data));
  }, []);

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return url;
  };

  const deliveryItems = [
    "أدوية", "مخضر (خضروات وفواكه)", "خبز وصمون", "كيك ومعجنات بأنواعها", "كبة وميني بيتزا", 
    "لحم بعجين", "أجبان وألبان", "حليب", "دجاج (ذبح وشوي)", "سمك (حي وشوي)", "طرشي", 
    "بهارات", "لحم", "مواد تجميل (كوزمتك)", "كرزات", "إنشائية", "كهربائيات", "قرطاسية", 
    "هدايا وأشياء طباعة", "ألعاب", "ملابس (مجمع النور، ضرار...)", "أحذية وشحاطات", 
    "هيدفون وشاحنة", "مفروشات", "مواد من أنسب الأسعار", "ذهب", "مواد غذائية والجملة", 
    "أقراص ألعاب", "معسل وفحم وكل مستلزمات الأركيلة", "أكل ولفات", "بانزين ودهن محركات", 
    "نودي ونجيب فلوس من مكان لمكان"
  ];

  const regions3k = [
    "الأسمدة", "جيكور", "حزبه", "العصفورية", "باب سليمان", "باب طويل", "باب العريض",
    "باب عباس", "كوت بازل", "باب دباغ", "باب ميدان", "بلد سلطان", "ام الصخر", "باب رمانه",
    "اهل عيد", "الباني", "نهر خوز", "ابو مغيرة", "مجيبرة", "السبيليات", "الصنگر", 
    "محيلة قبل دورة ام زباله", "طريق الوسطي", "العاگولية", "الصحراء", "ابو كوصرة", 
    "طريزاوية", "العوجة", "المقيمين", "الابطاح", "اللكطة", "الشجرة الطيبة", "شيخ ابراهيم", 
    "نزيلة", "عميرية", "بلد", "كوت البلجاني", "الحوطة", "السوق", "الصنكر", "محيله الوسطي", 
    "محيله قرب الجسر", "محيله بالسوق", "محيله قرب السيطرة", "محيله شارع المشروع", 
    "محيله قبل دورة ام زباله", "محيله شارع سيد حامد", "محيله شارع الاندلس", "محيله الصكاروة"
  ];

  const regions5k = [
    "المعهد الصناعي", "دورة ام زباله بعد الاستدارة", "الاندلس", "طريق سيد حامد بعد الاندلس",
    "الجديدة", "الرومية", "الصكاروة", "كوت الصلحي", "كوت الفداغ", "جامع الشهيد", "يوسفان",
    "حمدان", "كوت ثويني", "البهادرية", "محولة الزهير", "كوت الحمداني", "عويسيان", 
    "مهيجران", "السراجي"
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-['IBM_Plex_Sans_Arabic']" dir="rtl">
      
      {/* 1. Scrollytelling Hero */}
      <ScrollytellingHero />

      {/* 2. Main Content Wrapper */}
      <div className="relative z-20 bg-slate-50 mt-[-20vh] md:mt-[-10vh] pt-12 pb-24 rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          
          {/* Section: Save Number & Intro */}
          <section className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="inline-block bg-yellow-100 text-yellow-800 px-6 py-2 rounded-full font-bold text-lg mb-4 shadow-sm border border-yellow-200">
              أهم شيء... اخزن رقمنا باسم أبو الأكبر للتوصيل! 📌
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-slate-800 leading-tight">
              أبو الأكبر للتوصيل الشامل <br/>
              <span className="text-blue-600 text-2xl md:text-4xl mt-2 block">
                في أي مكان بأبي الخصيب... كلشي يصير بين ايديك!
              </span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed max-w-3xl mx-auto font-medium">
              إنت بالبيت، بالدوام، أو طالع... تفتح واتساب وتراسلني وتطلب <strong className="text-blue-600 font-bold">أي شيء</strong> راح أشتريه وأوصله إلك للبيت.
              <br/><br/>
              ليش لازم تخزن رقمنا ونخزن رقمك؟ لأن إحنا ننشر يومياً منتجات من شتى المحلات! اخزن رقمنا وراسلنا حتى تشوف الحالات.
            </p>
            
            <a 
              href="https://wa.me/9647733921468" 
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-lg shadow-green-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <MessageCircle className="w-7 h-7" />
              راسلنا الآن على الواتساب
            </a>
          </section>

          {/* Section: What we deliver */}
          <section className="bg-white rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-blue-100 rounded-2xl text-blue-600">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-800">شنو نكدر نوصلك؟</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {deliveryItems.map((item, i) => (
                <span key={i} className="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-transparent transition-colors text-slate-700 px-4 py-2 rounded-xl text-sm md:text-base font-medium">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
              <h4 className="text-xl font-bold text-blue-800 mb-2">تسوق من متجرنا الإلكتروني المتكامل!</h4>
              <p className="text-blue-600 mb-4 font-medium">موقع تسوق شامل لأهالي أبي الخصيب.</p>
              <a href="https://aboakbr.com/store" target="_blank" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                <Store className="w-5 h-5" />
                تصفح متجر خصيب ستور
              </a>
            </div>
          </section>

          {/* Section: YouTube Tutorial */}
          {links?.youtubeTutorial && (
            <section className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-2xl text-white text-center">
              <h3 className="text-2xl md:text-3xl font-bold mb-4">طريقة التسوق من الموقع</h3>
              <p className="text-slate-300 mb-8 font-medium">شرح مبسط لكيفية الطلب من متجرنا الإلكتروني بكل سهولة.</p>
              <div className="relative pt-[56.25%] rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={getYouTubeEmbedUrl(links.youtubeTutorial) || ""}
                  title="طريقة التسوق"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </section>
          )}

          {/* Section: B2B For Shop Owners */}
          <section className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-8 md:p-12 shadow-2xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <h3 className="text-3xl md:text-4xl font-black mb-4">يا هلا بأصحاب المحلات! 🏪</h3>
              <p className="text-blue-100 text-lg mb-10 font-medium">استمتعوا بمزايا التوصيل الاستثنائية المصممة خصيصاً لدعم أعمالكم:</p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <div className="flex items-start gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition">
                  <Banknote className="w-8 h-8 text-yellow-300 shrink-0 mt-1" />
                  <div><h4 className="font-bold text-xl mb-1">الدفع نقداً</h4><p className="text-blue-100 text-sm leading-relaxed">يسلمكم المندوب الحساب فوراً قبل مغادرة المكان.</p></div>
                </div>
                <div className="flex items-start gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition">
                  <Clock className="w-8 h-8 text-green-300 shrink-0 mt-1" />
                  <div><h4 className="font-bold text-xl mb-1">توصيل فوري ودقيق</h4><p className="text-blue-100 text-sm leading-relaxed">طلبات الصباح تصل صباحاً، والمساء تصل عصراً. أقصى تأخير 3 ساعات فقط! واحترام شديد لمواعيد التسليم.</p></div>
                </div>
                <div className="flex items-start gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition">
                  <RotateCcw className="w-8 h-8 text-pink-300 shrink-0 mt-1" />
                  <div><h4 className="font-bold text-xl mb-1">إعادة مجانية</h4><p className="text-blue-100 text-sm leading-relaxed">في حال عدم استجابة الزبون للاتصال، يتم إرجاع الطلب مجاناً.</p></div>
                </div>
                <div className="flex items-start gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition">
                  <Megaphone className="w-8 h-8 text-orange-300 shrink-0 mt-1" />
                  <div><h4 className="font-bold text-xl mb-1">ترويج لحساباتكم</h4><p className="text-blue-100 text-sm leading-relaxed">نشر حساباتكم عبر منصاتنا لزيادة طلبياتكم ومبيعاتكم.</p></div>
                </div>
                <div className="flex items-start gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition">
                  <Car className="w-8 h-8 text-cyan-300 shrink-0 mt-1" />
                  <div><h4 className="font-bold text-xl mb-1">أسطول حديث ومريح</h4><p className="text-blue-100 text-sm leading-relaxed">سيارات حديثة مكيفة، دراجات نارية سريعة، ومندوبين محترفين.</p></div>
                </div>
                <div className="flex items-start gap-4 bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition">
                  <Smartphone className="w-8 h-8 text-purple-300 shrink-0 mt-1" />
                  <div><h4 className="font-bold text-xl mb-1">نظام طلبات ذكي</h4><p className="text-blue-100 text-sm leading-relaxed">موقع مخصص لرفع ومتابعة طلباتكم بسهولة تامة.</p></div>
                </div>
              </div>

              {/* Web App Features */}
              <div className="bg-white text-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <Zap className="w-8 h-8 text-yellow-500" />
                  <h4 className="text-xl md:text-2xl font-black text-center">مميزات نظام الطلبات للمحلات</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3"><CheckCheck className="w-5 h-5 text-green-500" /> <span className="font-bold text-sm">بدون تحميل تطبيق</span></div>
                  <div className="flex items-center gap-3"><CheckCheck className="w-5 h-5 text-green-500" /> <span className="font-bold text-sm">بدون يوزرنيم أو باسورد</span></div>
                  <div className="flex items-center gap-3"><Mic className="w-5 h-5 text-blue-500" /> <span className="font-bold text-sm">تسجيل بصمة صوت</span></div>
                  <div className="flex items-center gap-3"><Camera className="w-5 h-5 text-pink-500" /> <span className="font-bold text-sm">إلتقاط صور للطلبية</span></div>
                  <div className="flex items-center gap-3"><ArrowLeftRight className="w-5 h-5 text-purple-500" /> <span className="font-bold text-sm">زر الطلب العكسي</span></div>
                  <div className="flex items-center gap-3"><CheckCheck className="w-5 h-5 text-green-500" /> <span className="font-bold text-sm">زر "كلشي واصل"</span></div>
                  <div className="flex items-center gap-3 md:col-span-3 justify-center mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <Car className="w-5 h-5 text-indigo-500" /> <span className="font-bold text-sm text-center">تحديد نوع المركبة المطلوبة (سيارة أو دراجة)</span>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-sm font-medium text-slate-500 mb-3">الموقع سيتعرف عليك مباشرة لرفع طلباتك بسرعة قياسية!</p>
                </div>
              </div>

            </div>
          </section>

          {/* Section: Pricing */}
          <section className="space-y-8">
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-800 mb-2">أسعار التوصيل (للطلبية الواحدة)</h3>
              <p className="text-slate-500 font-medium">أسعار تنافسية ومحددة بوضوح لجميع مناطق أبي الخصيب.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* 3000 List */}
              <div className="bg-white rounded-3xl p-6 shadow-lg border-t-4 border-green-500">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <h4 className="text-xl font-bold text-slate-800">مناطق 3,000 دينار</h4>
                  <span className="bg-green-100 text-green-700 font-black px-4 py-1 rounded-full text-lg">3K</span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {regions3k.map((r, i) => (
                    <span key={i} className="text-sm bg-slate-50 border border-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-medium">{r}</span>
                  ))}
                </div>
              </div>

              {/* 5000 List */}
              <div className="bg-white rounded-3xl p-6 shadow-lg border-t-4 border-blue-500">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <h4 className="text-xl font-bold text-slate-800">مناطق 5,000 دينار</h4>
                  <span className="bg-blue-100 text-blue-700 font-black px-4 py-1 rounded-full text-lg">5K</span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {regions5k.map((r, i) => (
                    <span key={i} className="text-sm bg-slate-50 border border-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-medium">{r}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Section: Social & Links */}
          <section className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 text-center">
            <h3 className="text-2xl font-black text-slate-800 mb-8">تواصل معنا وانضم لمجتمعنا</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <a href="https://wa.me/9647733921468" target="_blank" className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 transition border border-[#25D366]/20 group">
                <MessageCircle className="w-8 h-8 text-[#25D366] group-hover:scale-110 transition-transform" />
                <span className="font-bold text-slate-700">واتساب المندوب</span>
                <span className="text-sm text-slate-500 font-medium" dir="ltr">0773 392 1468</span>
              </a>
              
              <a href={links?.instagram || "https://instagram.com/k.o_kseb"} target="_blank" className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#E1306C]/10 hover:bg-[#E1306C]/20 transition border border-[#E1306C]/20 group">
                <Camera className="w-8 h-8 text-[#E1306C] group-hover:scale-110 transition-transform" />
                <span className="font-bold text-slate-700">إنستغرام</span>
                <span className="text-sm text-slate-500 font-medium" dir="ltr">@k.o_kseb</span>
              </a>

              <a href={links?.telegram || "https://t.me/ko_kseb"} target="_blank" className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 transition border border-[#0088cc]/20 group">
                <Send className="w-8 h-8 text-[#0088cc] group-hover:scale-110 transition-transform" />
                <span className="font-bold text-slate-700">قناة التليغرام</span>
                <span className="text-sm text-slate-500 font-medium">عروض ومنتجات</span>
              </a>

              <a href="https://chat.whatsapp.com/JSqEm7M1CgqBglStuRyItH" target="_blank" className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#128C7E]/10 hover:bg-[#128C7E]/20 transition border border-[#128C7E]/20 group sm:col-span-2 md:col-span-1">
                <Users className="w-8 h-8 text-[#128C7E] group-hover:scale-110 transition-transform" />
                <span className="font-bold text-slate-700">كروب الواتساب</span>
                <span className="text-sm text-slate-500 font-medium text-center">أكبر كروب بيع وشراء لأبي الخصيب (مختلط)</span>
              </a>

              <a href="https://t.me/+IIH_puHB8Mg2MDIy" target="_blank" className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 transition border border-[#0088cc]/20 group sm:col-span-2 md:col-span-1">
                <Users className="w-8 h-8 text-[#0088cc] group-hover:scale-110 transition-transform" />
                <span className="font-bold text-slate-700">كروب التليغرام</span>
                <span className="text-sm text-slate-500 font-medium text-center">أكبر كروب بيع وشراء لأبي الخصيب</span>
              </a>

              <a href="https://aboakbr.com/store" target="_blank" className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-slate-900 hover:bg-slate-800 transition border border-slate-800 group sm:col-span-2 md:col-span-1">
                <Store className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
                <span className="font-bold text-white">خصيب ستور</span>
                <span className="text-sm text-slate-300 font-medium text-center">متجر إلكتروني متكامل للكل</span>
              </a>
            </div>
          </section>

        </div>
      </div>

    </div>
  );
}
   
 