"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, ArrowLeft, CheckCircle2 } from "lucide-react";

interface ClientRebrandModalProps {
  greetingName: string;
}

const STORAGE_KEY_REBRAND_SEEN = "wasly_rebrand_notice_acknowledged_v1";

export function ClientRebrandModal({ greetingName }: ClientRebrandModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY_REBRAND_SEEN);
      if (!seen) {
        // تأخير بسيط 300 مللي ثانية حتى تكتمل حركة فتح الصفحة بسلاسة
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    } catch {
      // في حال تعذر الوصول إلى التخزين المحلي
    }
  }, []);

  const handleAcknowledge = () => {
    try {
      localStorage.setItem(STORAGE_KEY_REBRAND_SEEN, "true");
    } catch {
      // ignore
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const displayName = greetingName && greetingName !== "العميل" 
    ? greetingName 
    : "عميلنا العزيز";

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300 select-none"
      dir="rtl"
    >
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-[28px] bg-gradient-to-b from-[#FFFFFF] via-[#F0F9FF] to-[#E0F2FE] p-[22px] border-2 border-[#38BDF8]/60 shadow-[0_25px_60px_-15px_rgba(2,132,199,0.35)] text-center animate-in zoom-in-95 duration-300">
        
        {/* لمسات إضاءة خلفية دائرية */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#38BDF8]/25 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#FDE047]/20 rounded-full blur-2xl pointer-events-none" />

        {/* الأيقونة العلوية مع شارة وصلي */}
        <div className="relative mx-auto mb-4 w-[76px] h-[76px] flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] animate-pulse opacity-40 blur-md" />
          <div className="relative w-[76px] h-[76px] rounded-full p-[3px] bg-gradient-to-b from-[#38BDF8] via-[#0284C7] to-[#0369A1] shadow-lg flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
              <Image 
                src="/images/wasly-client-header-icon.png" 
                alt="وصلي" 
                width={62} 
                height={62} 
                className="object-contain"
                priority
              />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#10B981] text-white p-1 rounded-full shadow-md border-2 border-white">
            <Sparkles className="w-3.5 h-3.5 text-[#FDE047]" />
          </div>
        </div>

        {/* شارة التنبيه والتحديث */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0284C7]/10 border border-[#0284C7]/20 mb-3 text-[12px] font-bold text-[#0369A1]">
          <span className="w-2 h-2 rounded-full bg-[#0284C7] animate-ping" />
          <span>تنويه وتحديث مهم</span>
        </div>

        {/* الترحيب بالاسم */}
        <h2 className="text-[20px] font-black text-[#0369A1] leading-tight mb-2">
          أهلاً بك يا {displayName} 👋
        </h2>

        {/* نص الرسالة الرئيسي المطلوب */}
        <p className="text-[14px] text-slate-700 leading-relaxed font-semibold mb-4">
          نود أن نخبرك بأننا قمنا بتغيير اسم خدمتنا من:
        </p>

        {/* بطاقة التغيير من القديم إلى الجديد */}
        <div className="bg-white/80 backdrop-blur-sm rounded-[18px] p-3.5 border border-[#38BDF8]/30 shadow-sm mb-4 space-y-2.5">
          <div className="flex items-center justify-between px-3 py-2 rounded-[12px] bg-rose-50/80 border border-rose-100 text-rose-700 text-[13px] font-bold">
            <span className="text-[11px] text-rose-500 font-medium">الاسم السابق:</span>
            <span className="line-through decoration-rose-500 decoration-2">أبو الأكبر للتوصيل الشامل</span>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-[#0284C7]/15 flex items-center justify-center text-[#0284C7]">
              <ArrowLeft className="w-3.5 h-3.5 transform rotate-[-90deg] sm:rotate-0" />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] bg-gradient-to-r from-[#0369A1] to-[#0284C7] text-white text-[14px] font-black shadow-md shadow-[#0284C7]/20">
            <span className="text-[11px] text-sky-200 font-medium">الاسم الجديد:</span>
            <span className="flex items-center gap-1.5 text-[#FDE047] text-[16px] tracking-wide">
              وصلي 🚀
            </span>
          </div>
        </div>

        <p className="text-[12px] text-slate-500 font-medium mb-5">
          نفس الكادر والخدمة المميزة التي تثق بها، بهوية جديدة أسرع وأفضل!
        </p>

        {/* زر حسناً فهمت */}
        <button
          type="button"
          onClick={handleAcknowledge}
          className="w-full h-[48px] rounded-[16px] bg-gradient-to-r from-[#0284C7] via-[#0369A1] to-[#075985] text-white font-black text-[15px] shadow-[0_8px_20px_rgba(2,132,199,0.35)] hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-sky-300/30 cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5 text-[#FDE047]" />
          <span>حسناً، فهمت</span>
        </button>

      </div>
    </div>
  );
}
