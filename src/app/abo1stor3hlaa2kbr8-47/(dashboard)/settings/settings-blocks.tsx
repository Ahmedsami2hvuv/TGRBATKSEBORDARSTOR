"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { NotificationSoundPresetId } from "@/lib/notification-sound-presets";
import { NotificationSettingsForm } from "./notification-settings-form";
import { PurgeDemoDataForm } from "./purge-demo-data-form";
import { PricingSettingsForm } from "./pricing-settings-form";
import { IconSettingsForm } from "./icon-settings-form";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { WhatsappTemplateSettingsForm } from "./whatsapp-template-settings-form";
import { saveChatSettingsAction, saveRoleFeaturesAction, saveTrackingSettingsAction } from "./actions";
import { useRouter, useSearchParams } from "next/navigation";
import { RoleFeaturesConfig } from "@/lib/role-features-settings";
import { CourierButtonsSettings } from "./courier-buttons-settings";
import { TelegramBotsForm } from "./telegram-bots-form";
import { FontSettingsForm } from "./font-settings-form";
import { FloatingMenuSettings } from "./floating-menu-settings";
import { BackgroundsConfig } from "@/lib/background-settings";

type NotificationInitial = {
  adminEnabled: boolean;
  adminTitleSingle: string;
  adminTemplateSingle: string;
  adminTemplateMultiple: string;
  adminSoundEnabled: boolean;
  adminSoundPreset: NotificationSoundPresetId;
  mandoubEnabled: boolean;
  mandoubTitleSingle: string;
  mandoubTemplateSingle: string;
  mandoubTemplateMultiple: string;
  mandoubSoundEnabled: boolean;
  mandoubSoundPreset: NotificationSoundPresetId;
  preparerEnabled: boolean;
  preparerTitleSingle: string;
  preparerTemplateSingle: string;
  preparerTemplateMultiple: string;
  preparerTemplateWebsite: string;
  preparerSoundEnabled: boolean;
  preparerSoundPreset: NotificationSoundPresetId;
  telegramAdminIds: string;
};

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export function SettingsBlocks({
  notificationInitial,
  globalIcons,
  employeeShareTemplate,
  customerOrderTemplate,
  telegramNewOrderTemplate,
  chatEnabledInitial,
  trackingEnabledInitial,
  mandoubFeaturesInitial,
  preparerFeaturesInitial,
  telegramAdminsInitial,
  telegramBotsInitial,
  availableFonts,
  currentFont,
  globalSettingsInitial,
  backgroundsConfig,
}: {
  notificationInitial: NotificationInitial;
  globalIcons: GlobalIconsConfig;
  backgroundsConfig: BackgroundsConfig | null;
  employeeShareTemplate: string;
  customerOrderTemplate: string;
  telegramNewOrderTemplate: string;
  chatEnabledInitial: boolean;
  trackingEnabledInitial: boolean;
  mandoubFeaturesInitial: RoleFeaturesConfig;
  preparerFeaturesInitial: RoleFeaturesConfig;
  telegramAdminsInitial: Array<{ id: string; telegramUserId: string; name: string; active: boolean }>;
  telegramBotsInitial: any[];
  availableFonts: string[];
  currentFont: string;
  globalSettingsInitial: any;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "";

  const [chatEnabled, setChatEnabled] = useState(chatEnabledInitial);
  const [trackingEnabled, setTrackingEnabled] = useState(trackingEnabledInitial);
  const [chatSaving, setChatSaving] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);

  const [mandoubFeatures, setMandoubFeatures] = useState(mandoubFeaturesInitial);
  const [preparerFeatures, setPreparerFeatures] = useState(preparerFeaturesInitial);
  const [roleFeaturesSaving, setRoleFeaturesSaving] = useState(false);

  const [howToShopUrl, setHowToShopUrl] = useState("");
  const [productCardBgUrl, setProductCardBgUrl] = useState("");
  const [productCardBgOpacity, setProductCardBgOpacity] = useState(40);
  const [storeOrdersExcelEnabled, setStoreOrdersExcelEnabled] = useState(true);
  const [aiEnabledStore, setAiEnabledStore] = useState(false);
  const [globalProfitMargin, setGlobalProfitMargin] = useState(Number(globalSettingsInitial?.profitMargin || 0));
  const [loading, setLoading] = useState(false);

  // Fetch store settings on Tab active
  useEffect(() => {
    if (activeTab === "store-settings") {
      fetch(`/api${SECRET_ADMIN_PATH}/settings/store`)
        .then((res) => res.json())
        .then((data) => {
          setHowToShopUrl(data.how_to_shop_url || "");
          setProductCardBgUrl(data.product_card_bg_url || "");
          setStoreOrdersExcelEnabled(data.export_store_orders_excel_enabled !== false);
          setAiEnabledStore(data.ai_enabled === true);
          setProductCardBgOpacity(
            Number.isFinite(Number(data.product_card_bg_opacity))
              ? Math.min(100, Math.max(0, Math.round(Number(data.product_card_bg_opacity))))
              : 40
          );
          if (data.global_profit_margin !== undefined) {
             setGlobalProfitMargin(Number(data.global_profit_margin));
          }
        })
        .catch(err => console.error("Failed to load store settings:", err));
    }
  }, [activeTab]);

  const [telegramAdminIds, setTelegramAdminIds] = useState(notificationInitial.telegramAdminIds);
  const [telegramBots, setTelegramBots] = useState(telegramBotsInitial);
  const [telegramSaving, setTelegramSaving] = useState(false);

  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  // Style tones mapper
  const toneClasses = useMemo(() => {
    return (tone: string) => {
      switch (tone) {
        case "emerald":
          return {
            border: "border-emerald-100/90 hover:border-emerald-300",
            bg: "bg-white hover:bg-emerald-50/5",
            iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
            shadow: "hover:shadow-emerald-100/20",
            accentBar: "bg-emerald-500",
          };
        case "amber":
          return {
            border: "border-amber-100/90 hover:border-amber-300",
            bg: "bg-white hover:bg-amber-50/5",
            iconBg: "bg-amber-50 text-amber-600 border-amber-100",
            shadow: "hover:shadow-amber-100/20",
            accentBar: "bg-amber-500",
          };
        case "rose":
          return {
            border: "border-rose-100/90 hover:border-rose-300",
            bg: "bg-white hover:bg-rose-50/5",
            iconBg: "bg-rose-50 text-rose-600 border-rose-100",
            shadow: "hover:shadow-rose-100/20",
            accentBar: "bg-rose-500",
          };
        case "indigo":
          return {
            border: "border-indigo-100/90 hover:border-indigo-300",
            bg: "bg-white hover:bg-indigo-50/5",
            iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100",
            shadow: "hover:shadow-indigo-100/20",
            accentBar: "bg-indigo-500",
          };
        default:
          return {
            border: "border-sky-100/90 hover:border-sky-300",
            bg: "bg-white hover:bg-sky-50/5",
            iconBg: "bg-sky-50 text-sky-600 border-sky-100",
            shadow: "hover:shadow-sky-100/20",
            accentBar: "bg-sky-500",
          };
      }
    };
  }, []);

  // Blocks Configuration
  const blocks = useMemo(() => [
    {
      id: "floating-menu",
      title: "القائمة الدائرية 🔘",
      subtitle: "تخصيص الروابط والأقسام العائمة.",
      tone: "sky",
      content: <FloatingMenuSettings icons={globalIcons} />
    },
    {
      id: "resource-management",
      title: "إدارة الموارد 🔋",
      subtitle: "توفير استهلاك السيرفر (Vercel Edge).",
      tone: "rose",
      content: (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={chatEnabled}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setChatEnabled(val);
                    setChatSaving(true);
                    try {
                      await saveChatSettingsAction(val);
                    } finally {
                      setChatSaving(false);
                    }
                  }}
                  disabled={chatSaving}
                  className="mt-1 h-5 w-5 rounded-md border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  <span className="block text-sm font-black text-slate-800">تفعيل نظام الدردشة العالمي</span>
                  <span className="block text-[10px] text-slate-500">إيقاف الدردشة يوقف جميع طلبات الـ Polling من المتصفحات فوراً.</span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 border-t border-rose-100 pt-4">
                <input
                  type="checkbox"
                  checked={trackingEnabled}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setTrackingEnabled(val);
                    setTrackingSaving(true);
                    try {
                      await saveTrackingSettingsAction(val);
                    } finally {
                      setTrackingSaving(false);
                    }
                  }}
                  disabled={trackingSaving}
                  className="mt-1 h-5 w-5 rounded-md border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  <span className="block text-sm font-black text-slate-800">تفعيل تتبع المواقع (GPS)</span>
                  <span className="block text-[10px] text-slate-500">إيقاف التتبع يوقف إرسال نبضات الموقع (Heartbeats) من المناديب والمجهزين.</span>
                </span>
              </label>
            </div>
          </div>
          {(chatSaving || trackingSaving) && (
            <p className="text-[10px] font-bold text-rose-600 animate-pulse text-center">جاري تحديث الإعدادات العالمية...</p>
          )}
        </div>
      )
    },
    {
      id: "telegram-bots",
      title: "بوتات تليجرام 🤖",
      subtitle: "إضافة وإدارة بوتات النظام المتعددة.",
      tone: "indigo",
      content: <TelegramBotsForm initialBots={telegramBots} icons={globalIcons} />
    },
    {
      id: "global-font",
      title: "خط الموقع 🖋️",
      subtitle: "تغيير الخط الأساسي لكل واجهات النظام.",
      tone: "indigo",
      content: <FontSettingsForm availableFonts={availableFonts} currentFont={currentFont} />
    },
    {
      id: "telegram-admins",
      title: "مدراء البوت 🤖",
      subtitle: "تحديد الـ IDs المسموح لها بالتحكم بالبوت.",
      tone: "indigo",
      content: (
        <div className="space-y-6">
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black text-slate-800">إضافة مدير جديد</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                placeholder="Telegram ID"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
              <input
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="الاسم المستعار"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>
            <button
              disabled={telegramSaving || !newAdminId || !newAdminName}
              onClick={async () => {
                setTelegramSaving(true);
                try {
                  const actions = await import("./actions");
                  await actions.addTelegramAdminAction(newAdminId, newAdminName);
                  setNewAdminId("");
                  setNewAdminName("");
                  router.refresh();
                } finally {
                  setTelegramSaving(false);
                }
              }}
              className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm"
            >
              {telegramSaving ? "جاري الإضافة..." : "إضافة للمدراء"}
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-500 px-1">قائمة المدراء</h3>
            <div className="space-y-2">
              {telegramAdminsInitial.length === 0 && (
                <p className="text-[10px] text-center text-slate-400 py-2">لا يوجد مدراء معرفين حالياً.</p>
              )}
              {telegramAdminsInitial.map((adm) => (
                <div key={adm.id} className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${adm.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{adm.name}</p>
                    <p className="text-[10px] font-bold text-slate-500">{adm.telegramUserId}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={async () => {
                        const actions = await import("./actions");
                        await actions.toggleTelegramAdminActiveAction(adm.id, !adm.active);
                        router.refresh();
                      }}
                      className={`p-2 rounded-lg border transition ${adm.active ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}
                    >
                      <DynamicIcon iconKey={adm.active ? "ui_eye_off" : "ui_eye"} config={globalIcons} className="w-4 h-4" fallback={<span>{adm.active ? "🚫" : "✅"}</span>} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("هل أنت متأكد من حذف هذا المدير؟")) return;
                        const actions = await import("./actions");
                        await actions.deleteTelegramAdminAction(adm.id);
                        router.refresh();
                      }}
                      className="p-2 rounded-lg border bg-rose-50 border-rose-200 text-rose-600 transition"
                    >
                      <DynamicIcon iconKey="ui_trash" config={globalIcons} className="w-4 h-4" fallback={<span>🗑️</span>} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">نظام الـ IDs القديم (للتوافق)</label>
              <input
                value={telegramAdminIds}
                onChange={(e) => setTelegramAdminIds(e.target.value)}
                placeholder="1234567, 8901234"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-xs font-bold bg-slate-50/50"
              />
            </div>
            <button
              disabled={telegramSaving}
              onClick={async () => {
                setTelegramSaving(true);
                try {
                  await (await import("./actions")).saveTelegramAdminIdsAction(telegramAdminIds);
                  alert("تم الحفظ بنجاح");
                } finally {
                  setTelegramSaving(false);
                }
              }}
              className="mt-2 text-[10px] font-bold text-indigo-600 hover:underline"
            >
              {telegramSaving ? "جاري الحفظ..." : "تحديث القائمة القديمة"}
            </button>
          </div>
        </div>
      )
    },
    {
      id: "courier-buttons",
      title: "أزرار المندوب ⚡",
      subtitle: "تحكم في الأزرار التي تظهر للمندوب.",
      tone: "indigo",
      content: <CourierButtonsSettings />
    },
    {
      id: "role-features",
      title: "مميزات الأدوار 🛠️",
      subtitle: "أزرار الدردشة والذكاء الاصطناعي.",
      tone: "indigo",
      content: (
        <div className="space-y-6">
          {/* المندوب */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              إعدادات المندوب
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={mandoubFeatures.chatEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...mandoubFeatures, chatEnabled: e.target.checked };
                    setMandoubFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("mandoub", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الدردشة</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={mandoubFeatures.aiEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...mandoubFeatures, aiEnabled: e.target.checked };
                    setMandoubFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("mandoub", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الذكاء الاصطناعي</span>
              </label>
            </div>
          </div>

          {/* المجهز */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              إعدادات المجهز
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={preparerFeatures.chatEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...preparerFeatures, chatEnabled: e.target.checked };
                    setPreparerFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("preparer", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الدردشة</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={preparerFeatures.aiEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...preparerFeatures, aiEnabled: e.target.checked };
                    setPreparerFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("preparer", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الذكاء الاصطناعي</span>
              </label>
            </div>
          </div>
          {roleFeaturesSaving && <p className="text-[10px] font-bold text-indigo-600 animate-pulse text-center">جاري الحفظ...</p>}
        </div>
      )
    },
    {
      id: "icon-settings",
      title: "الأيقونات 🎭",
      subtitle: "تحكم في شكل واجهة التحميل.",
      tone: "sky",
      content: <IconSettingsForm initial={globalIcons} />
    },
    {
      id: "store-settings",
      title: "إعدادات المتجر 🛒",
      subtitle: "روابط وتخصيصات واجهة الزبائن.",
      tone: "indigo",
      content: (
        <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const formData = new FormData(e.currentTarget);
            try {
                const res = await fetch(`/api${SECRET_ADMIN_PATH}/settings/store`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (data.ok) {
                  alert("تم الحفظ بنجاح");
                }
            } finally {
                setLoading(false);
            }
        }}>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">الربح العام (د.ع)</label>
              <div className="flex gap-2">
                <input
                    type="number"
                    name="global_profit_margin"
                    value={globalProfitMargin}
                    onChange={(e) => setGlobalProfitMargin(Number(e.target.value))}
                    placeholder="مبلغ الربح المضاف"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-amber-50"
                />
                <div className="flex items-center px-3 bg-slate-100 rounded-xl text-[10px] font-black text-slate-500 whitespace-nowrap">
                   💰 الربح الافتراضي
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-bold px-1">يُطبق هذا الربح على جميع المنتجات مالم يتم تحديد ربح خاص للقسم أو الفرع.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">رابط "طريقة التسوق"</label>
              <input name="how_to_shop_url" value={howToShopUrl} onChange={(e) => setHowToShopUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">خلفية المنتج</label>
              <input type="file" name="product_card_bg_file" accept="image/*" className="w-full text-xs" />
            </div>
            <button disabled={loading} className="w-full py-2 bg-violet-600 text-white font-bold rounded-xl text-sm shadow-md shadow-violet-200">{loading ? "جاري..." : "حفظ"}</button>
          </div>
        </form>
      )
    },
    {
      id: "ui-designer",
      title: "مصمم الواجهات 🎨",
      subtitle: "الألوان والصور والترتيب.",
      tone: "indigo",
      isExternalLink: true,
      href: `${SECRET_ADMIN_PATH}/settings/ui-designer`
    },
    {
      id: "pricing-config",
      title: "التسعير والأنواع 💰",
      subtitle: "اللحوم والأسماك والأسعار.",
      tone: "amber",
      content: <PricingSettingsForm />
    },
    {
      id: "whatsapp",
      title: "إعدادات واتساب 📱",
      subtitle: "النماذج والأزرار.",
      tone: "emerald",
      content: <WhatsappTemplateSettingsForm initialEmployeeTemplate={employeeShareTemplate} initialCustomerTemplate={customerOrderTemplate} initialTelegramTemplate={telegramNewOrderTemplate} />
    },
    {
      id: "notifications",
      title: "الإشعارات 🔔",
      subtitle: "النصوص، النغمات، والتشغيل.",
      tone: "sky",
      content: <NotificationSettingsForm initial={notificationInitial} />
    },
    {
      id: "purge-demo",
      title: "مسح وتصفير الطلبات ⚠️",
      subtitle: "مسح جميع الطلبات من الأساس وبدء الترقيم من 1.",
      tone: "rose",
      content: <PurgeDemoDataForm />
    }
  ], [
    globalIcons, chatEnabled, chatSaving, trackingEnabled, trackingSaving,
    telegramBots, telegramSaving, availableFonts, currentFont, newAdminId,
    newAdminName, telegramAdminsInitial, telegramAdminIds, mandoubFeatures,
    roleFeaturesSaving, preparerFeatures, globalProfitMargin, howToShopUrl,
    employeeShareTemplate, customerOrderTemplate, telegramNewOrderTemplate,
    notificationInitial, loading
  ]);

  const activeBlock = useMemo(() => {
    if (!activeTab) return null;
    return blocks.find(b => b.id === activeTab) || null;
  }, [activeTab, blocks]);

  // If a tab is active, render it as a single full-page view
  if (activeBlock && !activeBlock.isExternalLink) {
    const tc = toneClasses(activeBlock.tone);
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`${SECRET_ADMIN_PATH}/settings`}
            className="inline-flex items-center gap-2 text-xs font-black text-slate-600 hover:text-slate-900 transition duration-200 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl border border-slate-200"
          >
            <span className="text-base">←</span>
            <span>العودة إلى الإعدادات</span>
          </Link>
        </div>

        <div className={`rounded-3xl border bg-white shadow-sm overflow-hidden ${tc.border}`}>
          {/* Header color accent bar */}
          <div className={`h-2.5 w-full ${tc.accentBar}`} />
          
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">{activeBlock.title}</h2>
            {activeBlock.subtitle && (
              <p className="mt-2 text-xs sm:text-sm font-bold text-slate-500 leading-relaxed">{activeBlock.subtitle}</p>
            )}
          </div>

          <div className="p-6 sm:p-8 bg-white">
            {activeBlock.content}
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, render the main Settings Grid
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {blocks.map((block) => {
        const tc = toneClasses(block.tone);
        const href = block.isExternalLink ? block.href! : `${SECRET_ADMIN_PATH}/settings?tab=${block.id}`;
        
        return (
          <Link
            key={block.id}
            href={href}
            className={`group relative overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${tc.border} ${tc.shadow}`}
          >
            {/* Accent colored indicator line */}
            <div className={`absolute top-0 right-0 left-0 h-1.5 transition-all duration-300 group-hover:h-2.5 ${tc.accentBar}`} />
            
            <div className="flex flex-col justify-between h-full min-h-[90px] gap-4 mt-1">
              <div className="space-y-2">
                <h3 className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-slate-800 transition-colors duration-200">
                  {block.title}
                </h3>
                {block.subtitle && (
                  <p className="text-xs leading-relaxed text-slate-400 font-bold group-hover:text-slate-500 transition-colors duration-200">
                    {block.subtitle}
                  </p>
                )}
              </div>
              
              <div className="flex justify-end pt-1">
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm transition-all duration-300 group-hover:scale-110 ${tc.iconBg}`}>
                  <svg
                    className="h-5 w-5 text-slate-400 group-hover:text-slate-700 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
