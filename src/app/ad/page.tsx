"use client";

import React from "react";
import Link from "next/link";
import {
  Store,
  Info,
  MessageCircle,
  ChevronLeft,
  Clock,
  ShieldCheck,
  MapPin
} from "lucide-react";

export default function AdLinksPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between items-center relative overflow-x-hidden font-sans p-4 sm:p-6"
    >
      {/* لمسات خلفية ناعمة تعكس ألوان وهوية وصلي الزرقاء المشرقة */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[#0088ff]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-amber-400/10 rounded-full blur-3xl" />
      </div>

      {/* الحاوية الرئيسية للهواتف */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto flex flex-col items-center">
        
        {/* قسم الهيدر: الشعار الرسمي وهوية وصلي */}
        <div className="flex flex-col items-center text-center mb-7 pt-2">
          {/* شعار وصلي في إطار دائري أبيض أنيق */}
          <div className="w-24 h-24 rounded-full bg-white p-2 border border-slate-200 shadow-md flex items-center justify-center mb-3.5">
            <img
              src="/images/wasly-logo.png"
              alt="وصلي"
              className="w-full h-full object-contain"
            />
          </div>

          {/* الاسم: وصلي فقط */}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
            <span className="text-[#0088ff]">وصلي</span>
          </h1>

          {/* النص الترويجي المعتمد */}
          <p className="text-sm font-semibold text-slate-600 mt-2 max-w-xs leading-relaxed">
            خدمة التوصيل والتسوق الأفضل لأهالي ابي الخصيب
          </p>
        </div>

        {/* الأزرار الرئيسية الثلاثة */}
        <div className="w-full flex flex-col gap-3.5 mb-7">
          
          {/* الزر الأول: تعرف علينا */}
          <Link
            href="/welcome"
            className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#0088ff] hover:shadow-md active:scale-[0.99] transition-all duration-200"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0088ff] group-hover:bg-[#0088ff] group-hover:text-white transition-colors">
                <Info className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h2 className="text-base font-bold text-slate-900 group-hover:text-[#0088ff] transition-colors">
                  تعرف علينا
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  معلومات عن خدماتنا وأسعار التوصيل ومناطق التغطية
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#0088ff] group-hover:bg-blue-50 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </Link>

          {/* الزر الثاني: متجر وصلي */}
          <Link
            href="/store"
            className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#0088ff] hover:shadow-md active:scale-[0.99] transition-all duration-200"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Store className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h2 className="text-base font-bold text-slate-900 group-hover:text-[#0088ff] transition-colors">
                  متجر وصلي
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تصفح المنتجات والمطاعم والسلع واطلب مباشرة
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#0088ff] group-hover:bg-blue-50 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </Link>

          {/* الزر الثالث: اطلب من عدنه بالواتس اب */}
          <a
            href="https://wa.me/message/J6B4PIOV"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between p-4 rounded-2xl bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-200"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
                <MessageCircle className="w-6 h-6 fill-white" />
              </div>
              <div className="text-right">
                <h2 className="text-base font-bold text-white">
                  اطلب من عدنه بالواتس اب
                </h2>
                <p className="text-xs text-white/90 mt-0.5">
                  تحدث معنا عبر الواتساب واطلب ما تريده بكل سهولة
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </a>

        </div>

        {/* مميزات سريعة ومختصرة */}
        <div className="w-full grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <Clock className="w-4 h-4 text-[#0088ff] mx-auto mb-1" />
            <div className="text-xs font-bold text-slate-800">توصيل سريع</div>
            <div className="text-[10px] text-slate-500">في أقصر وقت</div>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <MapPin className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <div className="text-xs font-bold text-slate-800">أبي الخصيب</div>
            <div className="text-[10px] text-slate-500">تغطية واسعة</div>
          </div>
          <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-[#25D366] mx-auto mb-1" />
            <div className="text-xs font-bold text-slate-800">ثقة وأمان</div>
            <div className="text-[10px] text-slate-500">خدمة ممتازة</div>
          </div>
        </div>

      </main>

      {/* الفوتر */}
      <footer className="relative z-10 w-full text-center text-xs text-slate-400 py-3 border-t border-slate-200/60 mt-6">
        <p>© {new Date().getFullYear()} وصلي — جميع الحقوق محفوظة</p>
      </footer>
    </div>
  );
}
