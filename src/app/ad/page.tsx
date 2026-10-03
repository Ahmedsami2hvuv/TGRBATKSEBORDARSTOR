"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  Sparkles,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Download,
  Share2,
  PhoneCall,
  Clock,
  ShieldCheck,
  Zap,
  MapPin,
  ArrowLeft
} from "lucide-react";

export default function AdLinksPage() {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const pageUrl = "https://aboakbr.com/ad";
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=15&color=080C0F&bgcolor=ffffff&data=${encodeURIComponent(pageUrl)}`;

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShare = async () => {
    if (navigator?.share) {
      try {
        await navigator.share({
          title: "وصلي للتوصيل - خدماتنا السريعة",
          text: "اطلب الآن عبر وصلي - توصيل أسرع .. لكل مكان في أبي الخصيب",
          url: pageUrl,
        });
      } catch (err) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#080C0F] text-white selection:bg-[#CCFF00] selection:text-black flex flex-col justify-between items-center relative overflow-x-hidden font-sans p-4 sm:p-6"
    >
      {/* إضاءات خلفية نيونية فخمة */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-12%] right-[-10%] w-[380px] h-[380px] bg-[#CCFF00] rounded-full blur-[140px] opacity-15" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[380px] h-[380px] bg-[#0088ff] rounded-full blur-[140px] opacity-15" />
      </div>

      {/* الحاوية الرئيسية المتجاوبة للموبايل */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto flex flex-col items-center">
        
        {/* قسم الهيدر والشعار */}
        <div className="flex flex-col items-center text-center mb-6 pt-4">
          <div className="relative group mb-3">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#CCFF00] via-[#0088ff] to-[#CCFF00] opacity-75 blur-md group-hover:opacity-100 transition duration-500 animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-[#0D1318] p-1.5 border-2 border-white/20 shadow-2xl flex items-center justify-center">
              <img
                src="/images/wasly-logo.png"
                alt="وصلي للتوصيل"
                className="w-full h-full object-contain rounded-full bg-white shadow-inner"
              />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            <span>وصلي للتوصيل</span>
            <span className="text-[#CCFF00]">.</span>
          </h1>

          <p className="text-sm text-gray-300 mt-1.5 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#CCFF00] fill-[#CCFF00]" />
            <span>خدمة التوصيل الأسرع والأوفر في أبي الخصيب</span>
          </p>

          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-medium text-gray-300">
            <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-ping" />
            <span className="text-white font-bold">متاحين لخدمتكم وتوصيل طلباتكم الآن</span>
          </div>
        </div>

        {/* الأزرار الرئيسية الثلاثة المطلوبة */}
        <div className="w-full flex flex-col gap-3.5 mb-6">
          
          {/* الزر 1: تعرف علينا */}
          <Link
            href="/welcome"
            className="group relative flex items-center justify-between p-4 rounded-2xl bg-gradient-to-l from-white/[0.08] to-white/[0.03] border border-white/15 hover:border-[#CCFF00]/60 hover:bg-white/[0.12] active:scale-[0.98] transition-all duration-300 shadow-lg hover:shadow-[0_0_25px_rgba(204,255,0,0.2)]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-400/20 border border-yellow-400/40 flex items-center justify-center text-yellow-300 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h2 className="text-base font-bold text-white group-hover:text-[#CCFF00] transition-colors flex items-center gap-1.5">
                  تعرف علينا
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">دليلنا</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  تعرف على خدماتنا، الأسعار، ومناطق التغطية الكاملة
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-[#CCFF00]/20 group-hover:translate-x-[-2px] transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>

          {/* الزر 2: متجر وصلي */}
          <Link
            href="/store"
            className="group relative flex items-center justify-between p-4 rounded-2xl bg-gradient-to-l from-white/[0.08] to-white/[0.03] border border-white/15 hover:border-[#0088ff]/60 hover:bg-white/[0.12] active:scale-[0.98] transition-all duration-300 shadow-lg hover:shadow-[0_0_25px_rgba(0,136,255,0.25)]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500/20 to-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition-transform">
                <Store className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h2 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                  متجر وصلي
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">أونلاين</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  تصفح المنتجات المتنوعة واطلب مباشرة بسهولة
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-[#0088ff]/20 group-hover:translate-x-[-2px] transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>

          {/* الزر 3: اطلب من عدنه بالواتس اب */}
          <a
            href="https://wa.me/message/J6B4PIOV"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-between p-4 rounded-2xl bg-gradient-to-l from-emerald-500/20 via-green-600/15 to-white/[0.04] border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/25 active:scale-[0.98] transition-all duration-300 shadow-lg hover:shadow-[0_0_25px_rgba(16,185,129,0.35)]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-400 flex items-center justify-center text-black font-bold group-hover:scale-110 transition-transform shadow-md">
                <MessageCircle className="w-6 h-6 text-black fill-black" />
              </div>
              <div className="text-right">
                <h2 className="text-base font-bold text-emerald-300 group-hover:text-white transition-colors flex items-center gap-1.5">
                  اطلب من عدنه بالواتس اب
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/30 text-emerald-200 border border-emerald-400/50">فوري ومباشر</span>
                </h2>
                <p className="text-xs text-gray-300 mt-0.5">
                  راسلنا بالواتساب فوراً وسجل طلبك مع الكابتن
                </p>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 group-hover:text-white group-hover:bg-emerald-500/40 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </a>

        </div>

        {/* أزرار مساعدة سريعة (كيو آر كود + نسخ الرابط + مشاركة) */}
        <div className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-2 mb-6">
          <button
            onClick={() => setShowQrModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-gray-200 transition-colors border border-white/5 active:scale-95"
            title="عرض باركود QR"
          >
            <QrCode className="w-4 h-4 text-[#CCFF00]" />
            <span>عرض الكود</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-gray-200 transition-colors border border-white/5 active:scale-95"
            title="نسخ الرابط"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">تم النسخ!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-cyan-400" />
                <span>نسخ الرابط</span>
              </>
            )}
          </button>

          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-gray-200 transition-colors border border-white/5 active:scale-95"
            title="مشاركة"
          >
            <Share2 className="w-4 h-4 text-purple-400" />
            <span>مشاركة</span>
          </button>
        </div>

        {/* معلومات سريعة عن الخدمة */}
        <div className="w-full grid grid-cols-3 gap-2 text-center mb-6">
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <Clock className="w-4 h-4 text-[#CCFF00] mx-auto mb-1" />
            <div className="text-[11px] font-bold text-gray-200">سرعة قياسية</div>
            <div className="text-[9px] text-gray-400">في دقائق عندك</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <MapPin className="w-4 h-4 text-[#0088ff] mx-auto mb-1" />
            <div className="text-[11px] font-bold text-gray-200">أبي الخصيب</div>
            <div className="text-[9px] text-gray-400">تغطية لكل القضاء</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <div className="text-[11px] font-bold text-gray-200">أمان وموثوقية</div>
            <div className="text-[9px] text-gray-400">كباتن محترفون</div>
          </div>
        </div>

      </main>

      {/* الفوتر */}
      <footer className="relative z-10 w-full text-center text-xs text-gray-500 py-2 border-t border-white/5">
        <p>© {new Date().getFullYear()} وصلي للتوصيل — جميع الحقوق محفوظة</p>
      </footer>

      {/* نافذة منبثقة لعرض رمز الكيو آر كود (QR Code) لطباعة الملصقات */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1720] border border-white/15 rounded-3xl p-6 max-w-xs w-full text-center relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-1">كود الإعلان (QR)</h3>
            <p className="text-xs text-gray-400 mb-4">
              يمكن مسحه بكاميرا الهاتف أو حفظه لطباعته على الدراجات والسيارات
            </p>

            <div className="bg-white p-3 rounded-2xl inline-block shadow-inner mb-4">
              <img
                src={qrImageUrl}
                alt="كود كيو آر لوصلي"
                className="w-48 h-48 rounded-lg"
              />
            </div>

            <div className="text-xs font-mono text-[#CCFF00] bg-white/5 p-2 rounded-lg mb-4 border border-white/10 break-all select-all">
              {pageUrl}
            </div>

            <div className="flex gap-2">
              <a
                href={qrImageUrl}
                download="wasly-qr-code.png"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#CCFF00] hover:bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>حفظ الصورة</span>
              </a>
              <button
                onClick={() => setShowQrModal(false)}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
