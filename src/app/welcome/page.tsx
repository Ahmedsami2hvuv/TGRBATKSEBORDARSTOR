"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageCircle,
  Phone,
  Send,
  Zap,
  CheckCircle2,
  Coffee,
  Sun,
  Moon,
  Truck,
  ShoppingBag,
  ShoppingCart,
  Handshake,
  BookmarkPlus
} from "lucide-react";

// قائمة المناطق الكاملة لقضاء أبي الخصيب
const regions3k = [
  'الاسمدة', 'جيكور حزبه', 'جيكور', 'العصفورية', 'باب سليمان', 'باب طويل',
  'باب العريض', 'باب عباس', 'كوت بازل', 'باب دباغ', 'باب ميدان', 'بلد سلطان',
  'ام الصخر', 'باب رمانه', 'اهل عيد', 'الباني', 'نهر خوز', 'ابو مغيرة',
  'مجيبرة', 'السبيليات', 'الصنگر', 'محيلة قبل دورة ام زباله', 'طريق الوسطي',
  'العاگولية', 'الصحراء', 'ابو كوصرة', 'طريزاوية', 'العوجة', 'المقيمين',
  'الابطاح', 'اللكطة', 'الشجرة الطيبة', 'شيخ ابراهيم', 'نزيلة', 'عميرية',
  'بلد', 'كوت البلجاني', 'الحوطة', 'السوق', 'الصنكر', 'محيله الوسطي',
  'محيله قرب الجسر', 'محيله بالسوق', 'محيله قرب السيطرة', 'محيله شارع المشروع'
];

const regions5k = [
  'محيله شارع سيد حامد', 'محيله شارع الاندلس', 'محيله الصكاروة', 'المعهد الصناعي',
  'دورة ام زباله بعد الاستدارة', 'الاندلس', 'طريق سيد حامد بعد الاندلس',
  'الجديدة', 'الرومية', 'الصكاروة', 'كوت الصلحي', 'كوت الفداغ', 'جامع الشهيد',
  'يوسفان', 'حمدان', 'كوت ثويني', 'البهادرية', 'محولة الزهير', 'كوت الحمداني',
  'عويسيان', 'مهيجران', 'السراجي'
];

export default function WelcomePage() {
  const [selectedPrice, setSelectedPrice] = useState<3000 | 5000>(3000);

  const currentRegions = selectedPrice === 3000 ? regions3k : regions5k;

  return (
    <div dir="rtl" className="min-h-screen bg-[#070B14] text-white selection:bg-[#FFC003] selection:text-black overflow-x-hidden font-sans">
      
      {/* أنيميشن شريط الكلمات التلقائي المتواصل كدائرة */}
      <style jsx global>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(50%); }
        }
        .animate-marquee-infinite {
          display: flex;
          width: max-content;
          animation: marquee-scroll 28s linear infinite;
        }
        .animate-marquee-infinite:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* خلفيات التوهج المستوحاة من هوية وصلي (أزرق وأصفر) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#178EF5] rounded-full blur-[170px] opacity-20" />
        <div className="absolute bottom-[20%] left-[-10%] w-[550px] h-[550px] bg-[#FFC003] rounded-full blur-[180px] opacity-15" />
        <div className="absolute top-[45%] right-[20%] w-[400px] h-[400px] bg-[#178EF5] rounded-full blur-[160px] opacity-10" />
      </div>

      {/* الشريط العلوي */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 backdrop-blur-2xl bg-[#070B14]/80 transition-all">
        <div className="mx-auto max-w-7xl px-4 md:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#178EF5] to-[#FFC003] opacity-75 blur-sm group-hover:opacity-100 transition-all duration-300" />
                <Image 
                  src="/images/wasly-logo-new.png" 
                  alt="شعار وصلي" 
                  width={40}
                  height={40}
                  className="relative w-10 h-10 object-contain rounded-full shadow-lg bg-white p-0.5 border border-white/20" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1 leading-none">
                  وصلي
                  <span className="w-2 h-2 rounded-full bg-[#FFC003] inline-block"></span>
                </span>
                <span className="text-[10px] font-mono text-[#178EF5] font-bold">WASLY DELIVERY</span>
              </div>
            </Link>

            <div className="hidden sm:flex items-center gap-2 text-xs font-mono tracking-wider bg-[#0E172B]/80 border border-[#178EF5]/20 rounded-full px-4 py-1.5 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#FFC003] animate-pulse" />
              <span className="text-white/80">14 مندوب متوفر الآن</span>
              <span className="w-px h-3 bg-white/20 mx-1" />
              <span className="text-[#178EF5] font-bold">أبي الخصيب</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/9647733921468"
              target="_blank"
              rel="noreferrer"
              className="h-11 px-5 rounded-full bg-gradient-to-r from-[#178EF5] to-[#0D70D0] text-white text-sm font-black hover:shadow-[0_0_25px_rgba(23,142,245,0.45)] transition-all flex items-center gap-2 border border-blue-400/30 active:scale-95"
            >
              <MessageCircle className="w-4 h-4 text-[#FFC003]" />
              <span>اطلب عبر واتساب</span>
            </a>
          </div>
        </div>
      </nav>

      {/* 1. القسم الرئيسي (Hero Section) */}
      <section className="relative pt-[125px] md:pt-[160px] pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          
          {/* نصوص الهيرو */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 mb-6 px-4 py-1.5 rounded-full bg-[#178EF5]/10 border border-[#178EF5]/30">
              <Zap className="w-4 h-4 text-[#FFC003] fill-[#FFC003]" />
              <span className="font-mono text-xs tracking-wider text-[#178EF5] font-bold">
                خدمة توصيل وصلي • أبي الخصيب
              </span>
            </div>

            <h1 className="font-black leading-[1.1] tracking-tight text-4xl sm:text-6xl lg:text-7xl mb-6">
              <span className="block text-white">كل اللي تحتاجه.</span>
              <span className="block text-white/50">بأي وقت وبأي مكان.</span>
              <span className="block bg-gradient-to-l from-[#FFC003] via-[#FFAE00] to-[#178EF5] bg-clip-text text-transparent">
                وصلي يوصل لبابك ⚡
              </span>
            </h1>

            <p className="text-base md:text-lg leading-relaxed text-white/70 font-normal max-w-xl mb-8">
              خدمة التوصيل الأسرع والأكثر أماناً في قضاء أبي الخصيب. لا تحتاج لتطبيق أو اشتراك، أرسل طلبك وموقعك عبر الواتساب وسيتكفل كادر &quot;وصلي&quot; بكل التفاصيل!
            </p>

            {/* الأزرار الرئيسية بتدرجات الشعار */}
            <div className="flex flex-wrap gap-4 mb-10">
              <a
                href="https://wa.me/9647733921468"
                target="_blank"
                rel="noreferrer"
                className="h-14 px-8 rounded-full bg-[#FFC003] hover:bg-[#ffca2c] text-black font-black text-base flex items-center gap-3 transition-all shadow-[0_0_30px_rgba(255,192,3,0.35)] active:scale-95"
              >
                <Send className="w-5 h-5 text-black" />
                <span>راسلنا واطلب الآن</span>
                <span className="w-7 h-7 rounded-full bg-black text-[#FFC003] flex items-center justify-center text-sm font-bold">
                  ↗
                </span>
              </a>

              <a
                href="tel:07733921468"
                className="h-14 px-7 rounded-full border border-white/20 hover:border-[#178EF5] hover:bg-[#178EF5]/10 text-sm md:text-base font-bold transition-all flex items-center gap-2.5 text-white active:scale-95"
              >
                <Phone className="w-5 h-5 text-[#178EF5]" />
                <span>اتصل بنا: 07733921468</span>
              </a>
            </div>

            {/* ميزات سريعة */}
            <div className="flex items-center gap-6 pt-6 border-t border-white/10">
              <div className="flex -space-x-2 space-x-reverse">
                <div className="w-10 h-10 rounded-full border-2 border-[#070B14] bg-[#FFC003] text-black font-black text-xs flex items-center justify-center shadow">99%</div>
                <div className="w-10 h-10 rounded-full border-2 border-[#070B14] bg-[#178EF5] text-white font-black text-xs flex items-center justify-center shadow">4.9★</div>
                <div className="w-10 h-10 rounded-full border-2 border-[#070B14] bg-white text-[#178EF5] font-black text-xs flex items-center justify-center shadow">⚡</div>
              </div>
              <div className="text-xs md:text-sm leading-snug">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>+1,200 طلب أسبوعياً</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#178EF5]/20 text-[#178EF5] border border-[#178EF5]/30">دقة وسرعة</span>
                </div>
                <div className="text-white/50 font-mono">توصيل بسيارات مبردة ودراجات حديثة ومجهزة</div>
              </div>
            </div>
          </div>

          {/* رادار التوصيل وتتبع المسار المحدث بألوان وصلي */}
          <div className="relative h-[490px] lg:h-[550px] rounded-[32px] border border-[#178EF5]/20 bg-gradient-to-b from-[#0C1527] to-[#070B14] overflow-hidden shadow-2xl flex flex-col justify-between p-6">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(23, 142, 245, 0.4) 1px, transparent 0)", backgroundSize: "24px 24px" }} />

            {/* الشريط العلوي في البطاقة */}
            <div className="relative z-10 flex justify-between items-center bg-[#070B14]/80 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFC003] animate-pulse" />
                <span className="font-mono text-xs font-bold text-white/90">قطاع أبي الخصيب - مباشر</span>
              </div>
              <div className="font-mono text-[11px] text-[#178EF5] bg-[#178EF5]/10 border border-[#178EF5]/30 px-3 py-1 rounded-full font-bold">
                66+ منطقة مغطاة
              </div>
            </div>

            {/* مسار دراجة التوصيل مع ألوان وصلي */}
            <div className="relative flex-1 my-4 flex items-center justify-center">
              <svg className="w-full h-full opacity-80" viewBox="0 0 400 300" fill="none">
                <defs>
                  <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#178EF5" />
                    <stop offset="50%" stopColor="#FFC003" />
                    <stop offset="100%" stopColor="#178EF5" />
                  </linearGradient>
                </defs>
                <path id="routePath" d="M 40 240 Q 120 40 200 150 T 360 80" stroke="url(#routeGradient)" strokeWidth="2.5" strokeDasharray="6 6"/>
                
                <circle cx="40" cy="240" r="7" fill="#178EF5"/>
                <text x="40" y="268" fill="#178EF5" fontSize="12" fontWeight="bold" textAnchor="middle">الاسمدة</text>
                
                <circle cx="200" cy="150" r="7" fill="#FFC003"/>
                <text x="200" y="178" fill="#FFC003" fontSize="12" fontWeight="bold" textAnchor="middle">المحيلة</text>
                
                <circle cx="360" cy="80" r="7" fill="#178EF5"/>
                <text x="360" y="108" fill="#178EF5" fontSize="12" fontWeight="bold" textAnchor="middle">السراجي</text>

                <g>
                  <circle r="14" fill="#FFC003" stroke="#FFFFFF" strokeWidth="2" />
                  <text textAnchor="middle" dy="4" fontSize="13">🛵</text>
                  <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#routePath"/>
                  </animateMotion>
                </g>
              </svg>
            </div>

            {/* بطاقة الطلب قيد التنفيذ */}
            <div className="relative z-10 bg-[#0A1222]/90 backdrop-blur-md border border-[#178EF5]/30 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#178EF5] to-[#38A3FF] text-white flex items-center justify-center font-black shrink-0 shadow">
                  <Zap className="w-5 h-5 text-[#FFC003] fill-[#FFC003]" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-white/50">طلب قيد التوصيل الآن</div>
                  <div className="text-xs sm:text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5">
                    <span>صيدلية النور</span>
                    <span className="text-[#FFC003] font-mono font-bold">←</span>
                    <span>نهر خوز</span>
                  </div>
                  <div className="text-[11px] text-[#178EF5] whitespace-nowrap">سيارات مبردة ودراجات مجهزة</div>
                </div>
              </div>
              <div className="text-left shrink-0">
                <div className="font-mono text-lg sm:text-xl font-black text-[#FFC003] leading-none">3,000</div>
                <div className="font-mono text-[10px] text-white/60">دينار عراقي</div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 2. شريط الكلمات المتحرك المتواصل ذاتياً بألوان هوية وصلي */}
      <div className="relative border-y border-white/10 bg-gradient-to-r from-[#178EF5] via-[#1075CD] to-[#178EF5] text-white overflow-hidden py-3.5 shadow-lg">
        <div className="animate-marquee-infinite font-black font-mono text-xs md:text-sm tracking-wider flex items-center gap-8">
          <span className="flex items-center gap-1"><span className="text-[#FFC003]">⚡</span> وصلي لخدمات التوصيل</span> <span>•</span>
          <span>💊 أدوية وصيدليات</span> <span>•</span>
          <span>🍔 مطاعم ووجبات</span> <span>•</span>
          <span>🛒 سوبرماركت ومخضر</span> <span>•</span>
          <span>🎁 هدايا ومناسبات</span> <span>•</span>
          <span>💄 كوزمتك ومكياج</span> <span>•</span>
          <span>🧁 حلويات وكيك</span> <span>•</span>
          <span>📚 قرطاسية ومستلزمات</span> <span>•</span>
          <span>🔄 استبدال وتوصيل فوري</span> <span>•</span>
          <span className="flex items-center gap-1"><span className="text-[#FFC003]">⚡</span> أسرع كادر توصيل بأبي الخصيب</span> <span>•</span>
          <span>💊 أدوية وصيدليات</span> <span>•</span>
          <span>🍔 مطاعم ووجبات</span> <span>•</span>
          <span>🛒 سوبرماركت ومخضر</span> <span>•</span>
          <span>🎁 هدايا ومناسبات</span> <span>•</span>
          <span>💄 كوزمتك ومكياج</span> <span>•</span>
          <span>🧁 حلويات وكيك</span> <span>•</span>
          <span>📚 قرطاسية ومستلزمات</span> <span>•</span>
          <span>🔄 استبدال وتوصيل فوري</span>
        </div>
      </div>

      {/* 3. قسم شلون نشتغل؟ */}
      <section className="py-12 md:py-16 border-b border-white/10 bg-[#090F1C]">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <div className="font-mono text-xs tracking-[0.25em] text-[#178EF5] font-bold">WORKFLOW // خطوات الطلب</div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">شلون نشتغل في وصلي؟ ⚡</h2>
            </div>
            <div className="font-mono text-xs text-white/70 bg-[#0E172B] border border-white/10 px-4 py-2 rounded-full">
              3 خطوات سهلة وبسيطة • بدون تعقيد
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            
            {/* 1. تطلب */}
            <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 hover:border-[#178EF5]/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[#178EF5] text-white flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-3xl font-black font-mono text-[#178EF5]/30">01</span>
                </div>
                <h3 className="text-lg font-black text-white mb-2">تطلب من الواتساب أو المتجر</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  أرسل رسالة نصية أو بصمة صوتية باحتياجاتك، مع تثبيت موقعك لمرة واحدة فقط.
                </p>
              </div>
            </div>

            {/* 2. نشتري إلك */}
            <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 hover:border-[#FFC003]/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[#FFC003] text-black flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-6 h-6 text-black" />
                  </div>
                  <span className="text-3xl font-black font-mono text-[#FFC003]/30">02</span>
                </div>
                <h3 className="text-lg font-black text-white mb-2">نشتري كل طلباتك بعناية</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  مندوبنا يشتري طلباتك من أفضل المحلات الموثوقة، ولو نقص شي نتواصل معك فوراً لتوفير البديل.
                </p>
              </div>
            </div>

            {/* 3. نوصلك الطلب */}
            <div className="rounded-2xl border border-white/10 bg-[#0D1526] p-6 hover:border-[#178EF5]/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#178EF5] to-[#38A3FF] text-white flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-3xl font-black font-mono text-[#178EF5]/30">03</span>
                </div>
                <h3 className="text-lg font-black text-white mb-2">نوصل طلبك لباب بيتك</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  التوصيل سريع وآمن بسيارات أو دراجات حديثة، مع حرية الدفع نقداً أو عبر البطاقة.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. قسم أوقات الدوام والشفتات */}
      <section className="py-16 md:py-20 border-b border-white/10 bg-[#070B14]">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="font-mono text-xs tracking-[0.25em] text-[#FFC003] mb-2 font-bold">TIMETABLE // الشفتات اليومية</div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">أوقات عمل وتوصيل الطلبات ⏰</h2>
            <p className="text-white/60 text-sm md:text-base mt-2">نظام شفتات منظم لضمان الالتزام بأدق المواعيد وجودة الخدمة</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {/* الصباح */}
            <div className="bg-[#0C1527] border border-white/10 rounded-[28px] p-6 md:p-8 hover:border-[#FFC003]/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#FFC003]/10 border border-[#FFC003]/30 text-[#FFC003] flex items-center justify-center mb-5 text-2xl group-hover:scale-110 transition-transform">
                <Sun className="w-6 h-6" />
              </div>
              <div className="text-[#FFC003] font-mono text-xs font-bold">الشفت الأول</div>
              <h3 className="text-xl font-black text-white mt-1 mb-2">الفترة الصباحية</h3>
              <p className="text-white/65 text-sm leading-relaxed">
                من الصباح الباكر حتى الساعة <strong>12:00 ظهراً</strong> لاستلام وتوصيل كافة طلبيات الصباح والصيدليات والمطاعم.
              </p>
            </div>

            {/* الاستراحة */}
            <div className="bg-[#0C1527] border border-white/10 rounded-[28px] p-6 md:p-8 hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-5 text-2xl group-hover:scale-110 transition-transform">
                <Coffee className="w-6 h-6" />
              </div>
              <div className="text-amber-400 font-mono text-xs font-bold">استراحة الكادر</div>
              <h3 className="text-xl font-black text-white mt-1 mb-2">استراحة الظهيرة</h3>
              <p className="text-white/65 text-sm leading-relaxed">
                استراحة لمدة <strong>4 ساعات</strong> (من الساعة 12:00 ظهراً إلى 4:00 عصراً) لتجهيز وترتيب شفت المساء.
              </p>
            </div>

            {/* المساء */}
            <div className="bg-[#0C1527] border border-white/10 rounded-[28px] p-6 md:p-8 hover:border-[#178EF5]/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#178EF5]/10 border border-[#178EF5]/30 text-[#178EF5] flex items-center justify-center mb-5 text-2xl group-hover:scale-110 transition-transform">
                <Moon className="w-6 h-6" />
              </div>
              <div className="text-[#178EF5] font-mono text-xs font-bold">الشفت الثاني</div>
              <h3 className="text-xl font-black text-white mt-1 mb-2">الفترة المسائية</h3>
              <p className="text-white/65 text-sm leading-relaxed">
                من الساعة <strong>4:00 عصراً</strong> وحتى الساعة <strong>8:00 مساءً</strong> لتوصيل وجبات العشاء وطلبيات المساء المتنوعة.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. فقرة حفظ الرقم المحدثة بألوان وصلي */}
      <section className="py-12 md:py-16 border-b border-white/10 bg-gradient-to-r from-[#0C1527] via-[#101C34] to-[#0C1527]">
        <div className="mx-auto max-w-5xl px-4 md:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFC003]/15 text-[#FFC003] border border-[#FFC003]/30 font-mono text-xs font-bold mb-4">
            <BookmarkPlus className="w-4 h-4" />
            <span>خزن الرقم مهم جداً</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-white mb-4">
            احفظ رقم &quot;وصلي&quot; حتى تشوف كل العروض والحالات اليومية! 📲
          </h2>
          <p className="text-white/70 text-sm md:text-base max-w-2xl mx-auto leading-relaxed mb-8">
            ننشر يومياً على حالة الواتساب أحدث العروض والمنتجات المتوفرة بمحلات ومطاعم أبي الخصيب، احفظ الرقم بجهازك لتكون على اطلاع دائم.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="tel:07733921468"
              className="h-14 px-8 rounded-full bg-[#FFC003] hover:bg-[#ffca2c] text-black font-black text-base flex items-center gap-3 transition-all shadow-[0_0_25px_rgba(255,192,3,0.3)] active:scale-95"
            >
              <Phone className="w-5 h-5" />
              <span>احفظ الرقم (07733921468)</span>
            </a>
            <a
              href="https://wa.me/9647733921468"
              target="_blank"
              rel="noreferrer"
              className="h-14 px-7 rounded-full border border-white/20 hover:border-[#178EF5] hover:bg-[#178EF5]/10 text-sm md:text-base font-bold transition-all flex items-center gap-2.5 text-white active:scale-95"
            >
              <MessageCircle className="w-5 h-5 text-[#178EF5]" />
              <span>مراسلة عبر واتساب</span>
            </a>
          </div>
        </div>
      </section>

      {/* 6. قسم المناطق والأسعار */}
      <section className="py-16 md:py-24 border-b border-white/10 bg-[#080E1A]" id="regions-section">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
            <div>
              <div className="font-mono text-xs tracking-[0.25em] text-[#178EF5] mb-2 font-bold">COVERAGE // دليل المناطق والأسعار</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-none">وين بيتكم بأبي الخصيب؟ 📍</h2>
            </div>

            {/* أزرار التبديل */}
            <div className="flex items-center gap-2 bg-[#070B14] border border-white/10 p-1.5 rounded-full shadow-inner">
              <button
                onClick={() => setSelectedPrice(3000)}
                className={`h-11 px-6 rounded-full font-black text-xs md:text-sm transition-all ${
                  selectedPrice === 3000
                    ? "bg-[#178EF5] text-white shadow-[0_0_20px_rgba(23,142,245,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                مناطق الـ 3,000 د.ع (44 منطقة)
              </button>
              <button
                onClick={() => setSelectedPrice(5000)}
                className={`h-11 px-6 rounded-full font-black text-xs md:text-sm transition-all ${
                  selectedPrice === 5000
                    ? "bg-[#FFC003] text-black shadow-[0_0_20px_rgba(255,192,3,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                مناطق الـ 5,000 د.ع (22 منطقة)
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* بطاقة معلومات الفئة */}
            <div className="bg-[#0C1527] border border-white/10 rounded-[28px] p-8 flex flex-col justify-between shadow-xl">
              <div>
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full font-mono text-xs font-bold mb-6 border ${
                    selectedPrice === 3000
                      ? "bg-[#178EF5]/15 text-[#178EF5] border-[#178EF5]/30"
                      : "bg-[#FFC003]/15 text-[#FFC003] border-[#FFC003]/30"
                  }`}
                >
                  {selectedPrice === 3000 ? "سعر التوصيل الثابت للمركز" : "سعر توصيل الأطراف والقرى"}
                </div>
                <h3 className="text-4xl font-black text-white mb-2">
                  {selectedPrice === 3000 ? "3,000 دينار" : "5,000 دينار"}
                </h3>
                <p className="text-white/65 text-sm leading-relaxed mb-6">
                  {selectedPrice === 3000
                    ? "يشمل كافة المناطق والأحياء داخل مركز قضاء أبي الخصيب والمناطق القريبة والمحيطة."
                    : "يشمل المناطق البعيدة والأطراف والقرى الممتدة في قضاء أبي الخصيب."}
                </p>
              </div>

              {/* الميزات */}
              <div className="space-y-4 pt-6 border-t border-white/10 text-sm text-white/85">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`w-5 h-5 ${selectedPrice === 3000 ? "text-[#178EF5]" : "text-[#FFC003]"} shrink-0`} />
                  <span className="font-bold">توصيل بدراجات حديثة وسيارات مكيفة ومبردة</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`w-5 h-5 ${selectedPrice === 3000 ? "text-[#178EF5]" : "text-[#FFC003]"} shrink-0`} />
                  <span className="font-bold">الدفع نقداً أو بطاقة إلكترونية عند الاستلام</span>
                </div>
              </div>
            </div>

            {/* سحابة أسماء المناطق */}
            <div className="lg:col-span-2 bg-[#0C1527] border border-white/10 rounded-[28px] p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="font-bold text-white text-base md:text-lg">قائمة المناطق المشمولة:</div>
                <div className="font-mono text-xs text-white/70 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {currentRegions.length} منطقة
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 max-h-[380px] overflow-y-auto pr-2 custom-scroll">
                {currentRegions.map((region, idx) => (
                  <div
                    key={region}
                    className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all hover:scale-105 cursor-pointer ${
                      selectedPrice === 3000
                        ? "bg-[#178EF5]/10 text-[#38A3FF] border-[#178EF5]/20 hover:border-[#178EF5]"
                        : "bg-[#FFC003]/10 text-[#FFC003] border-[#FFC003]/20 hover:border-[#FFC003]"
                    }`}
                  >
                    <span className="opacity-50 font-mono text-xs ml-1.5">{String(idx + 1).padStart(2, "0")}</span>
                    {region}
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. قسم التجار وأصحاب المحلات (B2B) */}
      <section className="py-16 md:py-24 border-b border-white/10 bg-[#070B14]">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          <div className="rounded-[36px] border border-[#178EF5]/30 bg-gradient-to-b from-[#0C1527] to-[#070B14] p-8 md:p-14 relative overflow-hidden shadow-[0_0_50px_rgba(23,142,245,0.15)]">
            
            <div className="grid lg:grid-cols-2 gap-10 items-center relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#178EF5] text-white font-mono text-[11px] font-black mb-6 shadow">
                  FOR MERCHANTS // لأصحاب الأنشطة والمحلات
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">
                  يا هلا بأصحاب المحلات والمتاجر! 🚚
                </h2>
                <p className="text-white/70 text-sm md:text-base leading-relaxed mb-8">
                  عندك محل أو صفحة بيع بأبي الخصيب؟ &quot;وصلي&quot; هو شريكك اللوجستي المعتمد بدون الحاجة لرواتب شهرية، وبأعلى درجات الأمانة والسرعة.
                </p>

                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 bg-[#070B14]/60 p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">💵</span>
                    <span className="font-bold text-sm">تسليم الحساب نقداً فوراً</span>
                  </div>
                  <div className="flex items-center gap-3 bg-[#070B14]/60 p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">🚀</span>
                    <span className="font-bold text-sm">توصيل سريع من 10 دقائق لـ 3 ساعات أقصى حد</span>
                  </div>
                  <div className="flex items-center gap-3 bg-[#070B14]/60 p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">📢</span>
                    <span className="font-bold text-sm">ترويج مجاني لحسابك ومحلك</span>
                  </div>
                  <div className="flex items-center gap-3 bg-[#070B14]/60 p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">🔄</span>
                    <span className="font-bold text-sm">إرجاع مجاني للطلب الذي لا يُرد</span>
                  </div>
                </div>

                <a
                  href="https://wa.me/9647733921468"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-[#FFC003] to-[#FFAE00] text-black font-black px-8 py-4 rounded-full text-sm md:text-base hover:shadow-[0_0_30px_rgba(255,192,3,0.4)] transition-all"
                >
                  <Handshake className="w-5 h-5 text-black" />
                  <span>انضم كشريك تجاري الآن</span>
                </a>
              </div>

              {/* بطاقة المجتمعات والكروبات */}
              <div className="bg-[#070B14]/80 border border-white/15 rounded-[28px] p-8 text-center flex flex-col justify-center backdrop-blur-md">
                <h3 className="text-2xl font-black text-white mb-3">مجتمعات البيع والشراء 👥</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  انضم لأكبر المجموعات التفاعلية الخاصة بمدينة أبي الخصيب لعرض منتجاتك والتواصل المباشر:
                </p>

                <div className="space-y-3">
                  <a
                    href="https://chat.whatsapp.com/JSqEm7M1CgqBglStuRyItH"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/20 transition-all text-xs md:text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5" />
                      <span>أكبر كروب واتساب للبيع والشراء</span>
                    </div>
                    <span>↗</span>
                  </a>

                  <a
                    href="https://t.me/+IIH_puHB8Mg2MDIy"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#178EF5]/10 border border-[#178EF5]/30 text-[#38A3FF] font-bold hover:bg-[#178EF5]/20 transition-all text-xs md:text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Send className="w-5 h-5" />
                      <span>أكبر كروب تليغرام للتجارة والخدمات</span>
                    </div>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. الفوتر ومتجر وصلي */}
      <footer className="pt-14 pb-12 bg-[#050810]">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          {/* بطاقة تذكير نهائي بحفظ الرقم */}
          <div className="bg-[#0C1527] border border-[#178EF5]/30 rounded-[32px] p-6 md:p-8 mb-10 text-center relative overflow-hidden shadow-[0_0_40px_rgba(23,142,245,0.1)]">
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-72 h-32 bg-[#178EF5]/15 blur-[80px] rounded-full pointer-events-none" />
            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFC003]/15 text-[#FFC003] font-mono text-xs font-bold mb-3">
                <Phone className="w-3.5 h-3.5" />
                <span>تذكير مهم</span>
              </span>
              <h3 className="text-xl md:text-3xl font-black text-white mb-2">
                قبل لا تغادر... لا تنسى تخزن رقمنا بجهازك! 📲
              </h3>
              <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-6">
                احفظ اسم (وصلي) برقم <strong>07733921468</strong> حتى تطلب بأي وقت بضغطة زر وتوصلك عروض محلات أبي الخصيب أول بأول.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="tel:07733921468"
                  className="h-12 px-7 rounded-full bg-[#FFC003] hover:bg-[#ffca2c] text-black font-black text-sm flex items-center gap-2.5 transition-all shadow-[0_0_20px_rgba(255,192,3,0.3)] active:scale-95"
                >
                  <Phone className="w-4 h-4" />
                  <span>احفظ الرقم (07733921468)</span>
                </a>
                <a
                  href="https://wa.me/9647733921468"
                  target="_blank"
                  rel="noreferrer"
                  className="h-12 px-6 rounded-full border border-white/20 hover:border-[#178EF5] text-white font-bold text-sm transition-all flex items-center gap-2 active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 text-[#178EF5]" />
                  <span>مراسلة واتساب</span>
                </a>
              </div>
            </div>
          </div>

          {/* بطاقة متجر وصلي */}
          <div className="bg-gradient-to-r from-[#0C1527] to-[#12203D] border border-[#178EF5]/25 rounded-[32px] p-8 md:p-12 mb-16 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <div className="font-mono text-[#FFC003] text-xs font-bold tracking-widest mb-2">WASLY STORE // متجر وصلي</div>
              <h3 className="text-2xl md:text-4xl font-black text-white mb-2">متجر تسوق شامل لأهالي أبي الخصيب 🛍️</h3>
              <p className="text-white/65 text-sm md:text-base max-w-xl">
                تصفح آلاف المنتجات من مختلف المحلات والمتاجر في مكان واحد مع توصيل مباشر للباب.
              </p>
            </div>
            <Link
              href="/store"
              className="shrink-0 inline-flex items-center gap-3 bg-[#178EF5] hover:bg-[#0f77d3] text-white font-black px-8 py-4 rounded-full text-base transition-all shadow-[0_0_30px_rgba(23,142,245,0.35)]"
            >
              <ShoppingCart className="w-5 h-5 text-[#FFC003]" />
              <span>ادخل لمتجر وصلي</span>
            </Link>
          </div>

          {/* روابط التواصل والحقوق */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-white/10 text-sm">
            <div className="flex items-center gap-3">
              <Image src="/images/wasly-logo-new.png" alt="وصلي" width={32} height={32} className="w-8 h-8 object-contain rounded-full bg-white shadow p-0.5 border border-white/20" />
              <span className="text-lg font-black text-white">وصلي لخدمات التوصيل</span>
              <span className="font-mono text-xs text-white/50">© 2026 - أسرع.. لكل مكان</span>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/k.o_kseb"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-pink-500 hover:text-pink-400 flex items-center justify-center transition-all"
                title="انستغرام"
              >
                <svg className="w-4 h-4 fill-none stroke-currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
              <a
                href="https://t.me/ko_kseb"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-[#178EF5] hover:text-[#178EF5] flex items-center justify-center transition-all"
                title="تليغرام"
              >
                <Send className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/9647733921468"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-[#FFC003] hover:text-[#FFC003] flex items-center justify-center transition-all"
                title="واتساب"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href="tel:07733921468"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-[#178EF5] hover:text-[#178EF5] flex items-center justify-center transition-all"
                title="اتصال"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
