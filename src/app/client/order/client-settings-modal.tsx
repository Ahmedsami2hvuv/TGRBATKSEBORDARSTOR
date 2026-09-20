"use client";

import { useState, useEffect } from "react";
import { Settings, MessageCircle, Star, PhoneCall, X, Check, ExternalLink } from "lucide-react";

interface ClientSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFeedback: () => void;
}

export const STORAGE_KEY_AUTO_WA = "kse_client_auto_wa_msg_enabled";

export function ClientSettingsModal({
  isOpen,
  onClose,
  onOpenFeedback,
}: ClientSettingsModalProps) {
  const [autoWaEnabled, setAutoWaEnabled] = useState(true);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTO_WA);
      if (saved !== null) {
        setAutoWaEnabled(saved === "true");
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  const handleToggleAutoWa = (val: boolean) => {
    setAutoWaEnabled(val);
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_WA, String(val));
      setIsSavedNotice(true);
      setTimeout(() => setIsSavedNotice(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-[16px] bg-[#05281C]/70 backdrop-blur-[10px] animate-in fade-in duration-200">
      <div className="relative w-full max-w-[390px] rounded-[28px] border-[2px] border-[#C9A86A] bg-[#FFFEFB] p-[20px] sm:p-[24px] shadow-[0_24px_64px_rgba(0,0,0,0.45)] animate-in zoom-in-95 duration-200 text-right">
        {/* زر الإغلاق العلوي */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-[18px] left-[18px] w-[32px] h-[32px] rounded-full bg-[#FFF8F0] border border-[#C9A86A]/40 flex items-center justify-center text-[#475569] hover:text-[#0A3D2E] hover:bg-white active:scale-95 transition"
        >
          <X className="w-[18px] h-[18px]" />
        </button>

        {/* رأس النافذة */}
        <div className="flex items-center gap-[10px] mb-[18px] pl-[36px]">
          <div className="w-[42px] h-[42px] rounded-[14px] bg-gradient-to-br from-[#0A3D2E] to-[#05281C] border-[1.5px] border-[#C9A86A] flex items-center justify-center text-[#F5D77F] shadow-sm shrink-0">
            <Settings className="w-[22px] h-[22px]" />
          </div>
          <div>
            <h2 className="text-[17px] font-black text-[#0A3D2E]">إعدادات صفحة العميل</h2>
            <p className="text-[11px] font-bold text-[#64748B]">تخصيص تجربتك والخيارات السريعة</p>
          </div>
        </div>

        {/* قائمة الخيارات */}
        <div className="space-y-[12px]">
          {/* 1. خيار تفعيل إرسال الواتساب التلقائي */}
          <div className="p-[14px] rounded-[18px] bg-[#FFF8F0] border border-[#C9A86A]/35 shadow-[0_2px_8px_rgba(5,40,28,0.03)] transition">
            <div className="flex items-start justify-between gap-[12px]">
              <div className="flex-1">
                <div className="flex items-center gap-[6px]">
                  <MessageCircle className="w-[16px] h-[16px] text-[#25D366]" />
                  <span className="text-[13px] font-black text-[#0A3D2E]">
                    إرسال تفاصيل الطلب للواتساب
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-[#475569] mt-[4px] leading-[1.5]">
                  فتح الواتساب وتجهيز رسالة تفاصيل الطلب فور إرسال الطلب بنجاح.
                </p>
              </div>

              {/* مفتاح التبديل (سويتش) */}
              <button
                type="button"
                role="switch"
                aria-checked={autoWaEnabled}
                onClick={() => handleToggleAutoWa(!autoWaEnabled)}
                className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoWaEnabled ? "bg-[#10B981]" : "bg-[#CBD5E1]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    autoWaEnabled ? "translate-x-0" : "-translate-x-[22px]"
                  }`}
                />
              </button>
            </div>
            {isSavedNotice && (
              <div className="mt-[6px] flex items-center gap-[4px] text-[10.5px] font-bold text-[#10B981] animate-in fade-in">
                <Check className="w-[13px] h-[13px]" />
                <span>تم حفظ التفضيل بنجاح</span>
              </div>
            )}
          </div>

          {/* 2. خيار التقييم */}
          <div className="p-[14px] rounded-[18px] bg-[#FFF8F0] border border-[#C9A86A]/35 shadow-[0_2px_8px_rgba(5,40,28,0.03)]">
            <div className="flex items-start gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#F5D77F]/30 border border-[#C9A86A]/40 flex items-center justify-center shrink-0 mt-[2px]">
                <Star className="w-[16px] h-[16px] text-[#C9A86A] fill-[#C9A86A]" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-black text-[#0A3D2E]">تقييم تجربة الاستخدام</h3>
                <p className="text-[11px] font-semibold text-[#475569] mt-[2px] leading-[1.5]">
                  شاركنا رأيك في التصميم والأزرار وسهولة الاستخدام.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFeedback();
                  }}
                  className="mt-[10px] w-full h-[36px] rounded-[12px] bg-gradient-to-r from-[#05281C] to-[#0A3D2E] border border-[#C9A86A]/70 text-[#F5D77F] font-bold text-[12px] shadow-sm active:scale-95 transition flex items-center justify-center gap-[6px]"
                >
                  <Star className="w-[13px] h-[13px] fill-[#F5D77F]" />
                  <span>فتح نافذة التقييم ⭐</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. خيار التواصل مع الإدارة */}
          <div className="p-[14px] rounded-[18px] bg-[#FFF8F0] border border-[#C9A86A]/35 shadow-[0_2px_8px_rgba(5,40,28,0.03)]">
            <div className="flex items-start gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-full bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center shrink-0 mt-[2px]">
                <PhoneCall className="w-[16px] h-[16px] text-[#1E9E4B]" />
              </div>
              <div className="flex-1">
                <h3 className="text-[13px] font-black text-[#0A3D2E]">التواصل المباشر مع الإدارة</h3>
                <p className="text-[11px] font-semibold text-[#475569] mt-[2px] leading-[1.5]">
                  فريق إدارة أبو الأكبر جاهز لمساعدتك والرد على كافة استفساراتك.
                </p>
                <a
                  href="https://api.whatsapp.com/send?phone=9647733921468"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[10px] w-full h-[36px] rounded-[12px] bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-[12px] shadow-sm active:scale-95 transition flex items-center justify-center gap-[6px]"
                >
                  <span>مراسلة الإدارة عبر الواتساب</span>
                  <ExternalLink className="w-[13px] h-[13px]" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* زر الإغلاق السفلي */}
        <div className="mt-[18px]">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-[40px] rounded-[14px] bg-[#FFF8F0] border border-[#C9A86A]/50 text-[#0A3D2E] font-black text-[13px] hover:bg-white active:scale-95 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
