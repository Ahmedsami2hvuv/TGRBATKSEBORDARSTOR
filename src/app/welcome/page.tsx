"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Phone,
  Send,
  Zap,
  CheckCircle2,
  Clock,
  Coffee,
  Sun,
  Moon,
  Truck,
  ShoppingBag,
  ShoppingCart,
  Users,
  Handshake,
  MapPin,
  ShieldCheck,
  CreditCard,
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
    <div dir="rtl" className="min-h-screen bg-[#080C0F] text-white selection:bg-[#CCFF00] selection:text-black overflow-x-hidden font-sans">
      
      {/* أنيميشن شريط الكلمات التلقائي المتواصل كدائرة */}
      <style jsx global>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(50%); }
        }
        .animate-marquee-infinite {
          display: flex;
          width: max-content;
          animation: marquee-scroll 25s linear infinite;
        }
        .animate-marquee-infinite:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* خلفيات التوهج النيوني */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-25">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#CCFF00] rounded-full blur-[150px] opacity-15" />
        <div className="absolute bottom-[20%] left-[-10%] w-[450px] h-[450px] bg-[#5FA8D3] rounded-full blur-[140px] opacity-15" />
      </div>

      {/* الشريط العلوي */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 backdrop-blur-xl bg-[#080C0F]/80">
        <div className="mx-auto max-w-7xl px-4 md:px-8 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" className="text-2xl font-black tracking-tight flex items-center gap-1">
              <span>أبو الأكبر</span>
              <span className="text-[#CCFF00]">.</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono tracking-wider bg-white/[0.05] border border-white/10 rounded-full px-3.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-pulse" />
              <span className="opacity-80">14 مندوب متاح الآن</span>
              <span className="w-px h-3 bg-white/20 mx-1" />
              <span className="text-[#CCFF00] font-bold">أبي الخصيب</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/9647733921468"
              target="_blank"
              rel="noreferrer"
              className="h-10 px-5 rounded-full bg-[#CCFF00] text-black text-sm font-black hover:bg-white transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.25)]"
            >
              <MessageCircle className="w-4 h-4" />
              <span>اطلب على واتساب</span>
            </a>
          </div>
        </div>
      </nav>

      {/* 1. القسم الرئيسي (Hero Section) */}
      <section className="relative pt-[120px] md:pt-[150px] pb-14 md:pb-20">
        <div className="mx-auto max-w-7xl px-4 md:px-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          
          {/* نصوص الهيرو */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="h-px w-10 bg-[#CCFF00]" />
              <span className="font-mono text-xs tracking-[0.25em] text-[#CCFF00] font-bold">
                نظام توصيل أبي الخصيب المطور v2.0
              </span>
            </div>

            <h1 className="font-black leading-[1.05] tracking-tight text-4xl sm:text-6xl lg:text-7xl mb-6">
              <span className="block text-white">كلشي تريده.</span>
              <span className="block text-white/40">بأي وقت ومن أي مكان.</span>
              <span className="block text-[#CCFF00]">يوصل لباب بيتك.</span>
            </h1>

            <p className="text-base md:text-lg leading-relaxed text-white/70 font-normal max-w-xl mb-8">
              خدمة توصيل فورية وشاملة داخل قضاء أبي الخصيب، بدون الحاجة لتحميل تطبيق أو تسجيل حساب، بس دز رسالة بالواتساب واحنه نتكفل بالباقي.
            </p>

            {/* الأزرار الرئيسية */}
            <div className="flex flex-wrap gap-4 mb-10">
              <a
                href="https://wa.me/9647733921468"
                target="_blank"
                rel="noreferrer"
                className="h-14 px-8 rounded-full bg-[#CCFF00] text-black font-black text-base flex items-center gap-3 hover:bg-white transition-all shadow-[0_0_30px_rgba(204,255,0,0.35)] active:scale-95"
              >
                <Send className="w-5 h-5" />
                <span>راسلنا واطلب الآن</span>
                <span className="w-7 h-7 rounded-full bg-black text-[#CCFF00] flex items-center justify-center text-sm font-bold">
                  ↗
                </span>
              </a>

              <a
                href="tel:07733921468"
                className="h-14 px-7 rounded-full border border-white/20 hover:border-white/50 hover:bg-white/[0.05] text-sm md:text-base font-bold transition-all flex items-center gap-2.5 text-white active:scale-95"
              >
                <Phone className="w-5 h-5 text-[#5FA8D3]" />
                <span>اتصل: 07733921468</span>
              </a>
            </div>

            {/* ميزات سريعة */}
            <div className="flex items-center gap-6 pt-6 border-t border-white/10">
              <div className="flex -space-x-2 space-x-reverse">
                <div className="w-10 h-10 rounded-full border-2 border-[#080C0F] bg-[#CCFF00] text-black font-black text-xs flex items-center justify-center">99%</div>
                <div className="w-10 h-10 rounded-full border-2 border-[#080C0F] bg-[#5FA8D3] text-black font-black text-xs flex items-center justify-center">4.9★</div>
                <div className="w-10 h-10 rounded-full border-2 border-[#080C0F] bg-white text-black font-black text-xs flex items-center justify-center">⚡</div>
              </div>
              <div className="text-xs md:text-sm leading-snug">
                <div className="font-bold text-white">+1,200 طلب أسبوعياً</div>
                <div className="text-white/40 font-mono">توصيل بسيارات مبردة ودراجات حديثة</div>
              </div>
            </div>
          </div>

          {/* رادار التوصيل والخريطة */}
          <div className="relative h-[480px] lg:h-[540px] rounded-[32px] border border-white/15 bg-[#0D1418] overflow-hidden shadow-2xl flex flex-col justify-between p-6">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)", backgroundSize: "24px 24px" }} />

            {/* الشريط العلوي في البطاقة */}
            <div className="relative z-10 flex justify-between items-center bg-black/60 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#CCFF00] animate-pulse" />
                <span className="font-mono text-xs font-bold text-white/90">قطاع أبي الخصيب - مباشر</span>
              </div>
              <div className="font-mono text-[11px] text-[#5FA8D3] bg-[#5FA8D3]/10 border border-[#5FA8D3]/30 px-3 py-1 rounded-full">
                66+ منطقة مغطاة
              </div>
            </div>

            {/* مسار دراجة التوصيل مع تعديل المركز إلى الاسمدة */}
            <div className="relative flex-1 my-4 flex items-center justify-center">
              <svg className="w-full h-full opacity-60" viewBox="0 0 400 300" fill="none">
                <path id="routePath" d="M 40 240 Q 120 40 200 150 T 360 80" stroke="rgba(204,255,0,0.3)" strokeWidth="2" strokeDasharray="6 6"/>
                <circle cx="40" cy="240" r="6" fill="#5FA8D3"/>
                <text x="40" y="265" fill="#5FA8D3" fontSize="11" fontWeight="bold" textAnchor="middle">الاسمدة</text>
                
                <circle cx="200" cy="150" r="6" fill="#CCFF00"/>
                <text x="200" y="175" fill="#CCFF00" fontSize="11" fontWeight="bold" textAnchor="middle">المحيلة</text>
                
                <circle cx="360" cy="80" r="6" fill="#5FA8D3"/>
                <text x="360" y="105" fill="#5FA8D3" fontSize="11" fontWeight="bold" textAnchor="middle">السراجي</text>

                <g>
                  <circle r="12" fill="#CCFF00" />
                  <text textAnchor="middle" dy="4" fontSize="12">🛵</text>
                  <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#routePath"/>
                  </animateMotion>
                </g>
              </svg>
            </div>

            {/* بطاقة الطلب قيد التنفيذ: صيدلية النور ← نهر خوز في سطر واحد */}
            <div className="relative z-10 bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#CCFF00] text-black flex items-center justify-center font-black shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-white/40">طلب قيد التوصيل الآن</div>
                  <div className="text-xs sm:text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5">
                    <span>صيدلية النور</span>
                    <span className="text-[#CCFF00] font-mono">←</span>
                    <span>نهر خوز</span>
                  </div>
                  <div className="text-[11px] text-[#5FA8D3] whitespace-nowrap">سيارات مبردة ودراجات حديثة</div>
                </div>
              </div>
              <div className="text-left shrink-0">
                <div className="font-mono text-lg sm:text-xl font-black text-[#CCFF00] leading-none">3,000</div>
                <div className="font-mono text-[9px] text-white/50">د.ع</div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 2. شريط الكلمات المتحرك المتواصل ذاتياً كدائرة */}
      <div className="relative border-y border-white/10 bg-[#CCFF00] text-black overflow-hidden py-3">
        <div className="animate-marquee-infinite font-black font-mono text-xs md:text-sm tracking-wider flex items-center gap-8">
          <span>💊 أدوية وصيدليات</span> <span>•</span>
          <span>🍔 مطاعم ووجبات</span> <span>•</span>
          <span>🛒 سوبرماركت ومخضر</span> <span>•</span>
          <span>🎁 هدايا ومناسبات</span> <span>•</span>
          <span>💄 كوزمتك ومكياج</span> <span>•</span>
          <span>🧁 حلويات وكيك</span> <span>•</span>
          <span>📚 قرطاسية ومستلزمات</span> <span>•</span>
          <span>🔄 استبدال وتوصيل فوري</span> <span>•</span>
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

      {/* 3. قسم شلون نشتغل؟ (مدمج وأنيق وبحجم متناسق) */}
      <section className="py-8 md:py-12 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <div className="font-mono text-xs tracking-[0.3em] text-[#CCFF00] font-bold">WORKFLOW // خطوات الطلب</div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">شلون نشتغل؟ ⚡</h2>
            </div>
            <div className="font-mono text-xs text-white/50 bg-white/[0.05] border border-white/10 px-3.5 py-1.5 rounded-full">
              3 خطوات بسيطة • بدون تطبيق
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            
            {/* 1. تطلب */}
            <div className="rounded-2xl border border-white/10 bg-[#0F171B] p-5 md:p-6 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#CCFF00] text-black flex items-center justify-center font-black">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black font-mono text-[#CCFF00]/40">1</span>
                </div>
                <h3 className="text-base md:text-lg font-black text-white mb-1.5">تطلب من الواتساب أو من المتجر</h3>
                <p className="text-white/70 text-xs md:text-sm leading-relaxed">
                  دز رسالة أو بصمة أو من المتجر أو بأي طريقة، ودزلنة موقعك مرة وحدة.
                </p>
              </div>
            </div>

            {/* 2. نشتري إلك */}
            <div className="rounded-2xl border border-white/10 bg-[#0F171B] p-5 md:p-6 hover:border-[#5FA8D3]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#5FA8D3] text-black flex items-center justify-center font-black">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black font-mono text-[#5FA8D3]/40">2</span>
                </div>
                <h3 className="text-base md:text-lg font-black text-white mb-1.5">نشتري إلك</h3>
                <p className="text-white/70 text-xs md:text-sm leading-relaxed">
                  نشتري إلك كل اللي طلبته واللي ممتوفر نبلغك حتى نشوفلك البديل.
                </p>
              </div>
            </div>

            {/* 3. نوصلك الطلب */}
            <div className="rounded-2xl border border-white/10 bg-[#0F171B] p-5 md:p-6 hover:border-[#CCFF00]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#CCFF00] text-black flex items-center justify-center font-black">
                    <Truck className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-black font-mono text-[#CCFF00]/40">3</span>
                </div>
                <h3 className="text-base md:text-lg font-black text-white mb-1.5">نوصلك الطلب</h3>
                <p className="text-white/70 text-xs md:text-sm leading-relaxed">
                  نوصلك الطلب لباب بيتك، وبراحتك تحب تدفع كاش أو ماستر كارد.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. قسم أوقات الدوام والشفتات (بعد شلون نشتغل) */}
      <section className="py-16 md:py-24 border-b border-white/10 bg-[#0A0F12]">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="font-mono text-xs tracking-[0.3em] text-[#CCFF00] mb-2 font-bold">TIMETABLE // الشفتات اليومية</div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">أوقات عمل وتوصيل الطلبات ⏰</h2>
            <p className="text-white/60 text-sm md:text-base mt-2">نعمل بنظام الشفتات المنتظمة لضمان دقة المواعيد وسرعة التوصيل</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {/* الصباح */}
            <div className="bg-[#0F171B] border border-white/10 rounded-[28px] p-6 md:p-8 hover:border-[#CCFF00]/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] flex items-center justify-center mb-5 text-2xl">
                <Sun className="w-6 h-6" />
              </div>
              <div className="text-[#CCFF00] font-mono text-xs font-bold">الشفت الأول</div>
              <h3 className="text-xl font-black text-white mt-1 mb-2">الفترة الصباحية</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                من الصباح الباكر حتى الساعة <strong>12:00 ظهراً</strong> لاستلام وتوصيل كافة طلبيات الصباح والصيدليات والمطاعم.
              </p>
            </div>

            {/* الاستراحة */}
            <div className="bg-[#0F171B] border border-white/10 rounded-[28px] p-6 md:p-8 hover:border-orange-500/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center mb-5 text-2xl">
                <Coffee className="w-6 h-6" />
              </div>
              <div className="text-orange-400 font-mono text-xs font-bold">استراحة الكادر</div>
              <h3 className="text-xl font-black text-white mt-1 mb-2">استراحة الظهيرة</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                استراحة لمدة <strong>4 ساعات</strong> (من الساعة 12:00 ظهراً إلى 4:00 عصراً) لتجهيز وترتيب شفت المساء.
              </p>
            </div>

            {/* المساء */}
            <div className="bg-[#0F171B] border border-white/10 rounded-[28px] p-6 md:p-8 hover:border-[#5FA8D3]/40 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[#5FA8D3]/10 border border-[#5FA8D3]/30 text-[#5FA8D3] flex items-center justify-center mb-5 text-2xl">
                <Moon className="w-6 h-6" />
              </div>
              <div className="text-[#5FA8D3] font-mono text-xs font-bold">الشفت الثاني</div>
              <h3 className="text-xl font-black text-white mt-1 mb-2">الفترة المسائية</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                من الساعة <strong>4:00 عصراً</strong> وحتى الساعة <strong>8:00 مساءً</strong> لتوصيل وجبات العشاء وطلبيات المساء.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. فقرة حفظ الرقم (مضافة قبل فقرة المحلات والمناطق) */}
      <section className="py-12 md:py-16 border-b border-white/10 bg-gradient-to-r from-[#0F171B] via-[#15232d] to-[#0F171B]">
        <div className="mx-auto max-w-5xl px-4 md:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30 font-mono text-xs font-bold mb-4">
            <BookmarkPlus className="w-4 h-4" />
            <span>خزن الرقم مهم جداً</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-white mb-4">
            اخزن رقمنا حتى تشوف كل الحالات اليومية والعروض! 📲
          </h2>
          <p className="text-white/70 text-sm md:text-base max-w-2xl mx-auto leading-relaxed mb-8">
            ننشر يومياً على حالة الواتساب أحدث العروض والمنتجات المتوفرة بشتى المحلات والمطاعم بأبي الخصيب، احفظ الرقم بجهازك حتى لا تفوتك الفرص والعروض الحصرية.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="tel:07733921468"
              className="h-14 px-8 rounded-full bg-[#CCFF00] text-black font-black text-base flex items-center gap-3 hover:bg-white transition-all shadow-[0_0_30px_rgba(204,255,0,0.3)] active:scale-95"
            >
              <Phone className="w-5 h-5" />
              <span>احفظ الرقم (07733921468)</span>
            </a>
            <a
              href="https://wa.me/9647733921468"
              target="_blank"
              rel="noreferrer"
              className="h-14 px-7 rounded-full border border-white/20 hover:border-white/50 hover:bg-white/[0.05] text-sm md:text-base font-bold transition-all flex items-center gap-2.5 text-white active:scale-95"
            >
              <MessageCircle className="w-5 h-5 text-green-400" />
              <span>مراسلة عبر واتساب</span>
            </a>
          </div>
        </div>
      </section>

      {/* 6. قسم المناطق والأسعار (تم تعديل الميزات وإزالة إرجاع مجاني) */}
      <section className="py-16 md:py-24 border-b border-white/10 bg-[#0A0F12]" id="regions-section">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
            <div>
              <div className="font-mono text-xs tracking-[0.3em] text-[#CCFF00] mb-2 font-bold">COVERAGE // دليل المناطق والأسعار</div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-none">وين بيتكم بأبي الخصيب؟ 📍</h2>
            </div>

            {/* أزرار التبديل */}
            <div className="flex items-center gap-2 bg-black border border-white/10 p-1.5 rounded-full">
              <button
                onClick={() => setSelectedPrice(3000)}
                className={`h-11 px-6 rounded-full font-black text-xs md:text-sm transition-all ${
                  selectedPrice === 3000
                    ? "bg-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                مناطق الـ 3,000 د.ع (44 منطقة)
              </button>
              <button
                onClick={() => setSelectedPrice(5000)}
                className={`h-11 px-6 rounded-full font-black text-xs md:text-sm transition-all ${
                  selectedPrice === 5000
                    ? "bg-[#5FA8D3] text-black shadow-[0_0_20px_rgba(95,168,211,0.3)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                مناطق الـ 5,000 د.ع (22 منطقة)
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* بطاقة معلومات الفئة */}
            <div className="bg-[#0F171B] border border-white/10 rounded-[28px] p-8 flex flex-col justify-between">
              <div>
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs font-bold mb-6 border ${
                    selectedPrice === 3000
                      ? "bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/30"
                      : "bg-[#5FA8D3]/15 text-[#5FA8D3] border-[#5FA8D3]/30"
                  }`}
                >
                  {selectedPrice === 3000 ? "سعر التوصيل الثابت" : "سعر توصيل الأطراف والقرى"}
                </div>
                <h3 className="text-4xl font-black text-white mb-2">
                  {selectedPrice === 3000 ? "3,000 دينار" : "5,000 دينار"}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  {selectedPrice === 3000
                    ? "يشمل كافة المناطق والأحياء داخل مركز قضاء أبي الخصيب والمناطق القريبة."
                    : "يشمل المناطق البعيدة والأطراف والقرى الممتدة في قضاء أبي الخصيب."}
                </p>
              </div>

              {/* الميزات المعدلة */}
              <div className="space-y-4 pt-6 border-t border-white/10 text-sm text-white/80">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#CCFF00] shrink-0" />
                  <span className="font-bold">توصيل بدراجات حديثة وسيارات مكيفة</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#CCFF00] shrink-0" />
                  <span className="font-bold">الدفع نقداً أو بطاقة عند الاستلام</span>
                </div>
              </div>
            </div>

            {/* سحابة أسماء المناطق */}
            <div className="lg:col-span-2 bg-[#0F171B] border border-white/10 rounded-[28px] p-8">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="font-bold text-white text-base md:text-lg">قائمة المناطق المشمولة:</div>
                <div className="font-mono text-xs text-white/50 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {currentRegions.length} منطقة
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 max-h-[380px] overflow-y-auto pr-2">
                {currentRegions.map((region, idx) => (
                  <div
                    key={region}
                    className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all hover:scale-105 cursor-pointer ${
                      selectedPrice === 3000
                        ? "bg-[#CCFF00]/10 text-[#CCFF00] border-[#CCFF00]/20 hover:border-[#CCFF00]"
                        : "bg-[#5FA8D3]/10 text-[#5FA8D3] border-[#5FA8D3]/20 hover:border-[#5FA8D3]"
                    }`}
                  >
                    <span className="opacity-40 font-mono text-xs ml-1.5">{String(idx + 1).padStart(2, "0")}</span>
                    {region}
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. قسم التجار وأصحاب المحلات (B2B - معدل النصوص بدقة) */}
      <section className="py-16 md:py-24 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          <div className="rounded-[36px] border-2 border-[#CCFF00] bg-[#0A0F12] p-8 md:p-14 relative overflow-hidden shadow-[0_0_50px_rgba(204,255,0,0.1)]">
            
            <div className="grid lg:grid-cols-2 gap-10 items-center relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CCFF00] text-black font-mono text-[11px] font-black mb-6">
                  FOR MERCHANTS // لأصحاب الأنشطة
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">
                  يا هلا بأصحاب المحلات والمتاجر! 🚚
                </h2>
                <p className="text-white/70 text-sm md:text-base leading-relaxed mb-8">
                  عندك محل أو بيج بيع بأبي الخصيب؟ احنا نكون كادر التوصيل الخاص بيك بدون التزام برواتب شهرية وبأعلى درجات الأمانة والسرعة.
                </p>

                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 bg-white/[0.04] p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">💵</span>
                    <span className="font-bold text-sm">تسليم الحساب نقداً فوراً</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/[0.04] p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">🚀</span>
                    <span className="font-bold text-sm">توصيل بنفس الفترة من 10 دقائق لـ 3 ساعات أقصى حد</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/[0.04] p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">📢</span>
                    <span className="font-bold text-sm">ترويج مجاني لحسابك ومحلك</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/[0.04] p-3.5 rounded-xl border border-white/10">
                    <span className="text-xl">🔄</span>
                    <span className="font-bold text-sm">إرجاع مجاني للطلب الذي لا يُرد</span>
                  </div>
                </div>

                <a
                  href="https://wa.me/9647733921468"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-3 bg-[#CCFF00] text-black font-black px-8 py-4 rounded-full text-sm md:text-base hover:bg-white transition-all shadow-[0_0_30px_rgba(204,255,0,0.35)]"
                >
                  <Handshake className="w-5 h-5" />
                  <span>انضم كشريك تجاري الآن</span>
                </a>
              </div>

              {/* بطاقة المجتمعات والكروبات */}
              <div className="bg-[#0F171B] border border-white/15 rounded-[28px] p-8 text-center flex flex-col justify-center">
                <h3 className="text-2xl font-black text-white mb-3">مجتمعات البيع والشراء 👥</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  انضم لأكبر المجموعات التفاعلية الخاصة بمدينة أبي الخصيب لعرض منتجاتك والتواصل المباشر:
                </p>

                <div className="space-y-3">
                  <a
                    href="https://chat.whatsapp.com/JSqEm7M1CgqBglStuRyItH"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 font-bold hover:bg-green-500/20 transition-all text-xs md:text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5" />
                      <span>أكبر كروب واتساب مختلط للبيع والشراء</span>
                    </div>
                    <span>↗</span>
                  </a>

                  <a
                    href="https://t.me/+IIH_puHB8Mg2MDIy"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold hover:bg-blue-500/20 transition-all text-xs md:text-sm"
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

      {/* 8. الفوتر ومتجر خصيبي ستور وتذكير حفظ الرقم */}
      <footer className="pt-14 pb-12 bg-[#080C0F]">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          
          {/* بطاقة تذكير نهائي بحفظ الرقم */}
          <div className="bg-[#0F171B] border border-[#CCFF00]/30 rounded-[32px] p-6 md:p-8 mb-10 text-center relative overflow-hidden shadow-[0_0_40px_rgba(204,255,0,0.08)]">
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-72 h-32 bg-[#CCFF00]/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#CCFF00]/15 text-[#CCFF00] font-mono text-xs font-bold mb-3">
                <Phone className="w-3.5 h-3.5" />
                <span>تذكير مهم</span>
              </span>
              <h3 className="text-xl md:text-3xl font-black text-white mb-2">
                قبل لا تطلع... لا تنسى تخزن رقمنا بجهازك! 📲
              </h3>
              <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-6">
                احفظ اسم (أبو الأكبر للتوصيل) برقم <strong>07733921468</strong> حتى تطلب بأي وقت بضغطة زر وتوصلك عروض محلات أبي الخصيب أول بأول.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="tel:07733921468"
                  className="h-12 px-7 rounded-full bg-[#CCFF00] text-black font-black text-sm flex items-center gap-2.5 hover:bg-white transition-all shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95"
                >
                  <Phone className="w-4 h-4" />
                  <span>احفظ الرقم (07733921468)</span>
                </a>
                <a
                  href="https://wa.me/9647733921468"
                  target="_blank"
                  rel="noreferrer"
                  className="h-12 px-6 rounded-full border border-white/20 hover:border-white/50 text-white font-bold text-sm transition-all flex items-center gap-2 active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 text-green-400" />
                  <span>مراسلة واتساب</span>
                </a>
              </div>
            </div>
          </div>

          {/* بطاقة متجر خصيبي ستور */}
          <div className="bg-gradient-to-r from-[#0F171B] to-[#142028] border border-white/15 rounded-[32px] p-8 md:p-12 mb-16 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <div className="font-mono text-[#CCFF00] text-xs font-bold tracking-widest mb-2">KHASEEBI STORE // متجر أبي الخصيب</div>
              <h3 className="text-2xl md:text-4xl font-black text-white mb-2">متجر تسوق شامل لأهالي أبي الخصيب 🛍️</h3>
              <p className="text-white/60 text-sm md:text-base max-w-xl">
                تصفح آلاف المنتجات من مختلف المحلات والمتاجر في مكان واحد مع توصيل مباشر للباب.
              </p>
            </div>
            <Link
              href="/store"
              className="shrink-0 inline-flex items-center gap-3 bg-[#5FA8D3] hover:bg-[#4a8eb9] text-white font-black px-8 py-4 rounded-full text-base transition-all shadow-[0_0_30px_rgba(95,168,211,0.3)]"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>ادخل لمتجر خصيبي ستور</span>
            </Link>
          </div>

          {/* روابط التواصل والحقوق */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-white/10 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black">أبو الأكبر للتوصيل</span>
              <span className="font-mono text-xs text-white/40">© 2026 - صنع بكل فخر لأهالي أبي الخصيب</span>
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
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-blue-400 hover:text-blue-400 flex items-center justify-center transition-all"
                title="تليغرام"
              >
                <Send className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/9647733921468"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-green-400 hover:text-green-400 flex items-center justify-center transition-all"
                title="واتساب"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href="tel:07733921468"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:border-[#CCFF00] hover:text-[#CCFF00] flex items-center justify-center transition-all"
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
