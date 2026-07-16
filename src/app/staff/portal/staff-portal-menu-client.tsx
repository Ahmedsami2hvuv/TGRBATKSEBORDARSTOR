"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getStaticBackgroundsConfigAction } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/settings/site-backgrounds-actions";
import { StaticBackgroundItem } from "@/lib/site-backgrounds";


export function StaffPortalMenuClient({
  emp,
  authQ
}: {
  emp: any;
  authQ: string;
}) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);
  const [scale, setScale] = useState(1);
  const [availableBgs, setAvailableBgs] = useState<StaticBackgroundItem[]>([]);
  const [currentBgId, setCurrentBgId] = useState<string | null>(null);
  const [showBgSelector, setShowBgSelector] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("kse:staff:scale");
    if (saved) setScale(parseFloat(saved));
    getGlobalIcons().then(setIcons);

    const handleData = (data: any) => {
      const activeItems = data?.items?.filter((item: any) => item.isActive) || [];
      setAvailableBgs(activeItems);

      const savedBg = localStorage.getItem("kse_user_background");
      if (savedBg) {
        setCurrentBgId(savedBg);
      } else {
        setCurrentBgId(data?.defaultBackgroundId || "default-gradient");
      }
    };

    const cached = localStorage.getItem("kse_backgrounds_config_cache");
    if (cached) {
      try {
        handleData(JSON.parse(cached));
      } catch (e) {}
    }

    getStaticBackgroundsConfigAction()
      .then((data: any) => {
        if (data) {
          handleData(data);
          localStorage.setItem("kse_backgrounds_config_cache", JSON.stringify(data));
        }
      })
      .catch((err) => console.error("Failed to load active backgrounds", err));
  }, []);

  const handleSelectBackground = (id: string) => {
    localStorage.setItem("kse_user_background", id);
    setCurrentBgId(id);
    window.dispatchEvent(new CustomEvent("kse_static_bg_changed", { detail: { id } }));
  };


  useEffect(() => {
    localStorage.setItem("kse:staff:scale", scale.toString());
  }, [scale]);

  return (
    <div className="mt-4">
      {/* التحكم في حجم القائمة */}
      <div className="flex items-center justify-between mb-6 bg-white/50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-white/10 backdrop-blur-sm">
        <span className="text-xs font-black text-slate-500 dark:text-slate-400 mr-2">تغيير حجم الواجهة</span>
        <div className="flex gap-2">
          <button
            onClick={() => setScale(prev => Math.max(0.8, prev - 0.1))}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-white/10 text-xl font-bold active:scale-90 transition-all"
          >
            −
          </button>
          <button
            onClick={() => setScale(prev => Math.min(5, prev + 0.1))}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-white/10 text-xl font-bold active:scale-90 transition-all text-sky-500"
          >
            +
          </button>
        </div>
      </div>
      {/* الخلفيات الثابتة للموظف */}
      {availableBgs.length > 0 && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowBgSelector(!showBgSelector)}
            className="w-full py-3.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm text-slate-800 dark:text-slate-200 shadow-sm transition-all active:scale-98 flex items-center justify-between px-5 outline-none backdrop-blur-sm"
          >
            <span>🎆 تغيير خلفية الحساب</span>
            <span className="text-xs text-slate-400 font-bold">{showBgSelector ? "▲ إخفاء" : "▼ عرض"}</span>
          </button>

          {showBgSelector && (
            <div className="kse-glass-dark mt-3 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm transition-all duration-300">
              <div className="mb-4">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">اختر خلفية النظام</h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">اختر خلفية ثابتة لتزيين واجهة حسابك ومريحة لعينيك</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {availableBgs.map((bg) => {
                  const active = currentBgId === bg.id;

                  return (
                    <button
                      key={bg.id}
                      onClick={() => handleSelectBackground(bg.id)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-black transition-all ${
                        active
                          ? "bg-sky-500 border-sky-600 text-white dark:bg-sky-400 dark:border-sky-400 dark:text-black shadow-md scale-[1.02]"
                          : "border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850"
                      }`}
                    >
                      <span className="truncate">{bg.name}</span>
                      {active && <span className="text-[9px] font-black bg-white/20 dark:bg-black/10 px-1.5 py-0.5 rounded-full">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-3" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {emp.canSubmitOrders && (
        <>
          <a
            href={`https://t.me/modf_Aboakbr_Bot?start=staff_${emp.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group w-full rounded-2xl bg-[#0088cc] py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_telegram"
              config={icons}
              className="w-5 h-5"
              fallback={<span>🔹</span>}
            />
            {emp.telegramUserId ? "الحساب مرتبط بالتيليجرام ✅" : "ربط الحساب ببوت التيليجرام"}
          </a>

          <Link
            href={`/staff/portal/preparation?${authQ}`}
            className="group w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_flash"
              config={icons}
              className="w-5 h-5"
              fallback={<span>🚀</span>}
            />
            إنشاء طلب تجهيز ذكي (تحليل)
          </Link>

          <Link
            href={`/staff/portal/double-order?${authQ}`}
            className="group w-full rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_map"
              config={icons}
              className="w-5 h-5"
              fallback={<span>📍</span>}
            />
            رفع طلب ذو وجهتين (مرسل-مستلم)
          </Link>

          <Link
            href={`/staff/portal/salary-wallet?${authQ}`}
            className="group w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-700 py-4 text-sm font-black text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <DynamicIcon
              iconKey="ui_invoice"
              config={icons}
              className="w-5 h-5"
              fallback={<span>💵</span>}
            />
            المحفظة ورواتب الموظف
          </Link>


        </>
      )}

      {emp.canViewArchived && (
        <Link
          href={`/staff/portal/archived?${authQ}`}
          className="group w-full rounded-2xl border-2 border-slate-300 bg-slate-50 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95 flex items-center justify-center gap-2"
        >
          <DynamicIcon
            iconKey="ui_box"
            config={icons}
            className="w-5 h-5 opacity-70"
            fallback={<span>📦</span>}
          />
          الأرشيف (الطلبات القديمة)
        </Link>
      )}

      {emp.canManageStore && (
        <Link
          href={`/staff/portal/store?${authQ}`}
          className="group w-full rounded-2xl border-2 border-purple-400 bg-white py-4 text-sm font-black text-purple-900 shadow-sm transition hover:bg-purple-50 active:scale-95 flex items-center justify-center gap-2"
        >
          <DynamicIcon
            iconKey="ui_shops"
            config={icons}
            className="w-5 h-5"
            fallback={<span>🏪</span>}
          />
          إدارة المتجر (الأقسام والمنتجات)
        </Link>
      )}

      {!emp.canSubmitOrders && !emp.canViewArchived && !emp.canManageStore && (
        <p className="p-4 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl">
          ليس لديك أي صلاحيات نشطة حالياً. يرجى مراجعة المسؤول.
        </p>
      )}
      </div>
    </div>
  );
}
