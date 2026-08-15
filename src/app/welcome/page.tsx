"use client";

import React, { useEffect, useState } from "react";
import { getSocialLinksAction, SocialLinksConfig } from "@/lib/social-links";
import { motion } from "framer-motion";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  Store,
  Phone,
  MessageCircle,
  Send,
  Users,
  ShoppingBag,
  Heart,
  ChevronDown,
  Info,
  Save,
  CheckCircle2,
  Banknote, 
  Zap, 
  Clock, 
  UserCheck, 
  RefreshCcw, 
  Megaphone, 
  Car, 
  MonitorSmartphone, 
  MapPin, 
  Mic, 
  Camera, 
  ArrowRightLeft, 
  CheckCheck, 
  Bike
} from "lucide-react";

export default function WelcomePage() {
  const [links, setLinks] = useState<SocialLinksConfig | null>(null);

  useEffect(() => {
    // جلب الروابط من الإعدادات
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

  const services = [
    { name: "أدوية وصيدلية", icon: "💊" },
    { name: "مخضر وفواكه", icon: "🍎" },
    { name: "خبز وصمون حار", icon: "🥖" },
    { name: "كيك ومعجنات", icon: "🍰" },
    { name: "كبة ولحم بعجين", icon: "🥩" },
    { name: "أجبان وألبان", icon: "🧀" },
    { name: "دجاج وسمچ شوي", icon: "🍗" },
    { name: "طرشي وبهارات", icon: "🌶️" },
    { name: "مواد تجميل", icon: "💄" },
    { name: "كرزات وتسالي", icon: "🥜" },
    { name: "إنشائية وكهربائيات", icon: "💡" },
    { name: "قرطاسية وهدايا", icon: "🎁" },
    { name: "ألعاب وملابس", icon: "👕" },
    { name: "مفروشات وأثاث", icon: "🛏️" },
    { name: "ذهب ومجوهرات", icon: "💍" },
    { name: "مواد غذائية", icon: "📦" },
    { name: "مستلزمات أركيلة", icon: "💨" },
    { name: "بانزين ودهن محركات", icon: "🛢️" },
    { name: "توصيل أموال وأمانات", icon: "💸" },
  ];

  const socialLinks = [
    {
      name: "متجرنا خصيب ستور",
      url: links?.website || "https://aboakbr.com",
      icon: <Store className="w-6 h-6" />,
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      name: "راسلنا على الواتساب",
      url: links?.whatsapp || "https://wa.me/9647733921468",
      icon: <MessageCircle className="w-6 h-6" />,
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      name: "تابعنا على الانستغرام",
      url: links?.instagram || "https://instagram.com/k.o_kseb",
      icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>,
      color: "bg-pink-600 hover:bg-pink-700",
    },
    {
      name: "قناتنا على التليجرام",
      url: links?.telegram || "https://t.me/ko_kseb",
      icon: <Send className="w-6 h-6" />,
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      name: "كروب الواتساب للبيع والشراء",
      url: links?.whatsappGroup || "https://chat.whatsapp.com/JSqEm7M1CgqBglStuRyItH",
      icon: <Users className="w-6 h-6" />,
      color: "bg-teal-500 hover:bg-teal-600",
    },
    {
      name: "كروب التليجرام للبيع والشراء",
      url: links?.telegramGroup || "https://t.me/+IIH_puHB8Mg2MDIy",
      icon: <Users className="w-6 h-6" />,
      color: "bg-sky-500 hover:bg-sky-600",
    },
  ];

  if (links?.facebook) {
    socialLinks.push({
      name: "صفحتنا على فيسبوك",
      url: links.facebook,
      icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>,
      color: "bg-blue-700 hover:bg-blue-800",
    });
  }

  if (links?.tiktok) {
    socialLinks.push({
      name: "حسابنا على تيك توك",
      url: links.tiktok,
      icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.8-5.46-.4-2.52.41-5.18 2.21-6.94 1.56-1.52 3.8-2.26 5.95-2.1v4.21c-.81-.07-1.63.15-2.28.64-.81.6-1.32 1.57-1.35 2.59-.03 1.01.41 1.99 1.14 2.63.78.68 1.91.89 2.87.58.94-.3 1.69-1.12 1.94-2.09.17-.67.2-1.38.19-2.07-.02-3.95-.01-7.91-.01-11.86Z"/></svg>,
      color: "bg-slate-900 hover:bg-black",
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-200 selection:text-blue-900 pb-16">
      {/* Header / Hero Section */}
      <header className="bg-gradient-to-b from-blue-600 to-blue-500 text-white rounded-b-[3rem] shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 pt-12 pb-16 relative z-10 text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="w-28 h-28 mx-auto bg-white rounded-full flex items-center justify-center shadow-xl mb-6 border-4 border-blue-100"
          >
            <ShoppingBag className="w-14 h-14 text-blue-600" />
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-5xl font-bold mb-4 leading-tight"
          >
            أهلاً بك في <span className="text-yellow-300">أبو الأكبر</span>
            <br /> للتوصيل الشامل
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto"
          >
            كل شي تحتاجه بأبي الخصيب، نجيبه لحد باب بيتك وأنت مرتاح!
          </motion.p>
        </div>
        
        {/* Animated Wave */}
        <div className="absolute bottom-0 left-0 right-0">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full h-auto drop-shadow-md">
             <path fill="#f8fafc" fillOpacity="1" d="M0,128L48,138.7C96,149,192,171,288,165.3C384,160,480,128,576,133.3C672,139,768,181,864,186.7C960,192,1056,160,1152,144C1248,128,1344,128,1392,128L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
           </svg>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6">
        
        {/* Animation Section */}
        <section className="flex justify-center mb-10 relative z-20">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md flex flex-col items-center justify-center border border-slate-100 overflow-hidden"
          >
            {links?.animationUrl ? (
              (links.animationUrl.endsWith(".lottie") || links.animationUrl.endsWith(".json")) ? (
                <DotLottieReact src={links.animationUrl} loop autoplay className="w-full h-64 mb-4" />
              ) : (
                <img src={links.animationUrl} alt="Delivery Animation" className="w-full h-64 object-contain rounded-2xl mb-4" />
              )
            ) : (
              <motion.div
                animate={{ 
                  x: [-15, 15, -15],
                  y: [-5, 5, -5],
                  rotate: [-5, 5, -5]
                }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="bg-blue-100 p-6 rounded-full mb-4"
              >
                <Bike className="w-20 h-20 text-blue-600" />
              </motion.div>
            )}
            <h2 className="text-center text-xl font-bold text-blue-800 mt-2">وين ما كنت، نوصلك!</h2>
          </motion.div>
        </section>

        {/* Essential Instruction */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 mb-12 shadow-md text-center"
        >
          <Save className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-yellow-800 mb-2">قبل كل شي... خطوة مهمة!</h2>
          <p className="text-lg text-yellow-900 mb-4">
            الرجاء خزن رقمنا باسم <strong>(أبو الأكبر للتوصيل)</strong> حتى تقدر تشوف الحالات (الستوريات) اللي ننزل بيها عروض يومية من شتى المحلات. 
          </p>
          <a 
            href="tel:07733921468" 
            className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-3 px-6 rounded-full transition-colors"
          >
            <Phone className="w-5 h-5" />
            07733921468
          </a>
        </motion.section>

        {/* Services Section */}
        <section className="max-w-5xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-blue-900 mb-3 flex items-center justify-center gap-2">
              <CheckCircle2 className="text-blue-500" /> شنو نكدر نوصلك؟
            </h2>
            <p className="text-slate-600 text-lg">
              افتح واتساب، اطلب أي شي يخطر ببالك... وإحنا نتكفل بالباقي!
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {services.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center gap-3 hover:shadow-md transition-all group"
              >
                <div className="text-4xl group-hover:scale-110 transition-transform duration-300">{service.icon}</div>
                <span className="font-semibold text-slate-700 text-sm md:text-base">{service.name}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 font-medium">
             ... وكل شي يصير بين إيديك وين ما كنت بأبي الخصيب!
          </div>
        </section>

        {/* B2B Section for Shops and Pages */}
        <section className="max-w-5xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-blue-900 mb-3 flex items-center justify-center gap-2">
              <Store className="text-blue-500" /> أصحاب المحلات والبيجات التجارية
            </h2>
            <p className="text-slate-600 text-lg px-4">
              استمتعوا بمزايا التوصيل المتوفرة لدينا خصيصاً لدعم أعمالكم!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 px-4">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-start">
              <div className="bg-green-100 text-green-600 p-3 rounded-xl"><Banknote className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg mb-1">الدفع نقداً</h3>
                <p className="text-slate-600 text-sm">يسلمكم المندوب الحساب قبل مغادرة المكان مباشرة.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-start">
              <div className="bg-amber-100 text-amber-600 p-3 rounded-xl"><Zap className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg mb-1">توصيل فوري</h3>
                <p className="text-slate-600 text-sm">الطلبات الصباحية تصل صباحاً، والمسائية تصل عصراً/مغرباً. أقصى تأخير 3 ساعات فقط للظروف.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-start">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-xl"><Clock className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg mb-1">احترام شديد للمواعيد</h3>
                <p className="text-slate-600 text-sm">التزام تام بموعد استلام وتسليم الطلبيات.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-start">
              <div className="bg-indigo-100 text-indigo-600 p-3 rounded-xl"><UserCheck className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg mb-1">مندوبين محترفين</h3>
                <p className="text-slate-600 text-sm">مختارين بعناية ومدربين على أعلى مستوى من الاحترام واللباقة.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-start">
              <div className="bg-red-100 text-red-600 p-3 rounded-xl"><RefreshCcw className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg mb-1">إعادة الطلبات مجاناً</h3>
                <p className="text-slate-600 text-sm">في حال عدم استجابة الزبون للاتصال، يتم إرجاع الطلب لكم مجاناً.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-start">
              <div className="bg-pink-100 text-pink-600 p-3 rounded-xl"><Megaphone className="w-6 h-6" /></div>
              <div>
                <h3 className="font-bold text-lg mb-1">الترويج لحساباتكم</h3>
                <p className="text-slate-600 text-sm">نقوم بنشر حساباتكم عبر حساباتنا وقنواتنا لزيادة الطلبيات لكم.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4 md:col-span-2 items-start">
              <div className="bg-sky-100 text-sky-600 p-3 rounded-xl"><MonitorSmartphone className="w-6 h-6" /></div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-2 text-sky-800">موقع مخصص لرفع طلباتكم بسهولة</h3>
                <p className="text-sm text-slate-600 mb-3">يغنيك عن تحميل التطبيقات، الموقع سيتعرف عليك مباشرة لرفع طلباتك!</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  <span className="flex items-center gap-1 text-sm text-slate-700 bg-slate-50 p-1.5 rounded border"><CheckCheck className="w-4 h-4 text-green-500" /> بدون يوزر وباسورد</span>
                  <span className="flex items-center gap-1 text-sm text-slate-700 bg-slate-50 p-1.5 rounded border"><Mic className="w-4 h-4 text-blue-500" /> بصمة صوت بالطلبية</span>
                  <span className="flex items-center gap-1 text-sm text-slate-700 bg-slate-50 p-1.5 rounded border"><Camera className="w-4 h-4 text-pink-500" /> التقاط صور للطلب</span>
                  <span className="flex items-center gap-1 text-sm text-slate-700 bg-slate-50 p-1.5 rounded border"><ArrowRightLeft className="w-4 h-4 text-orange-500" /> زر الطلب العكسي</span>
                  <span className="flex items-center gap-1 text-sm text-slate-700 bg-slate-50 p-1.5 rounded border"><Car className="w-4 h-4 text-slate-500" /> سيارات حديثة مكيفة</span>
                  <span className="flex items-center gap-1 text-sm text-slate-700 bg-slate-50 p-1.5 rounded border"><Bike className="w-4 h-4 text-red-500" /> دراجات سريعة</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="max-w-4xl mx-auto mb-16 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 mx-4">
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 p-6 text-white text-center">
            <MapPin className="w-10 h-10 mx-auto mb-2" />
            <h2 className="text-2xl font-bold">أسعار التوصيل حسب المناطق</h2>
            <p className="opacity-90 mt-1">الأسعار للطلبية الواحدة لجميع مناطق أبي الخصيب</p>
          </div>
          
          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
            {/* 3000 Regions */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="text-xl font-bold text-slate-800">مناطق على 3</h3>
                <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-sm">3,000 دينار</span>
              </div>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-3 text-sm text-slate-600 list-disc list-inside">
                <li>الاسمدة</li><li>جيكور حزبه</li><li>جيكور</li><li>العصفورية</li>
                <li>باب سليمان</li><li>باب طويل</li><li>باب العريض</li><li>باب عباس</li>
                <li>كوت بازل</li><li>باب دباغ</li><li>باب ميدان</li><li>بلد سلطان</li>
                <li>ام الصخر</li><li>باب رمانه</li><li>اهل عيد</li><li>الباني</li>
                <li>نهر خوز</li><li>ابو مغيرة</li><li>مجيبرة</li><li>السبيليات</li>
                <li>الصنكر</li><li>طريق الوسطي</li><li>العاكولية</li><li>الصحراء</li>
                <li>ابو كوصرة</li><li>طريزاوية</li><li>العوجة</li><li>المقيمين</li>
                <li>الابطاح</li><li>اللكطة</li><li>الشجرة الطيبة</li><li>شيخ ابراهيم</li>
                <li>نزيلة</li><li>عميرية</li><li>بلد</li><li>كوت البلجاني</li>
                <li>الحوطة</li><li>السوق</li><li>محيله (فروع)</li>
              </ul>
            </div>

            {/* 5000 Regions */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="text-xl font-bold text-slate-800">مناطق على 5</h3>
                <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full text-sm">5,000 دينار</span>
              </div>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-3 text-sm text-slate-600 list-disc list-inside">
                <li>المعهد الصناعي</li><li>دورة ام زباله</li><li>الاندلس</li><li>الجديدة</li>
                <li>الرومية</li><li>الصكاروة</li><li>كوت الصلحي</li><li>كوت الفداغ</li>
                <li>جامع الشهيد</li><li>يوسفان</li><li>حمدان</li><li>كوت ثويني</li>
                <li>البهادرية</li><li>محولة الزهير</li><li>كوت الحمداني</li><li>عويسيان</li>
                <li>مهيجران</li><li>السراجي</li>
              </ul>
              <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                  * بعض فروع محيلة البعيدة مثل شارع سيد حامد، الاندلس، الصكاروة تكون على 5,000.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How to order video */}
        {links?.youtubeTutorial && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden mb-16"
          >
            <div className="bg-red-600 p-6 text-white text-center">
              <svg className="w-12 h-12 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
              <h2 className="text-2xl font-bold">طريقة التسوق من موقعنا</h2>
              <p className="opacity-90 mt-1">شاهد هذا الفيديو السريع لتعرف شون تطلب من الموقع بسهولة</p>
            </div>
            <div className="aspect-video w-full bg-slate-900">
              <iframe 
                width="100%" 
                height="100%" 
                src={getYouTubeEmbedUrl(links.youtubeTutorial) || links.youtubeTutorial} 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerPolicy="strict-origin-when-cross-origin" 
                allowFullScreen
              ></iframe>
            </div>
          </motion.section>
        )}

        {/* Links & Social Media */}
        <section className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-blue-900 mb-3">
              حساباتنا وروابطنا
            </h2>
            <p className="text-slate-600 text-lg">
              خليك على تواصل ويانا دائماً ولا تفوت العروض!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {socialLinks.map((link, index) => (
              <motion.a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className={`${link.color} text-white p-5 rounded-2xl flex items-center gap-4 shadow-md transition-all`}
              >
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                  {link.icon}
                </div>
                <span className="font-bold text-lg">{link.name}</span>
              </motion.a>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-16 text-center text-slate-500 pb-8 px-4">
        <Heart className="w-6 h-6 text-red-500 mx-auto mb-2 animate-bounce" />
        <p>نخدمكم بعيوننا - أبو الأكبر للتوصيل الشامل</p>
        <p className="text-sm mt-1">أبي الخصيب - البصرة</p>
      </footer>
    </div>
  );
}
