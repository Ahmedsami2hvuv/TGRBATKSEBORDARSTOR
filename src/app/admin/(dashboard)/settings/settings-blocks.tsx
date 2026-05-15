"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { NotificationSoundPresetId } from "@/lib/notification-sound-presets";
import { NotificationSettingsForm } from "./notification-settings-form";
import { PurgeDemoDataForm } from "./purge-demo-data-form";
import { TestPushNotificationsForm } from "./test-push-notifications-form";
import { PricingSettingsForm } from "./pricing-settings-form";
import { CleanupBase64Form } from "./cleanup-base64-form";
import { IconSettingsForm } from "./icon-settings-form";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { WhatsappTemplateSettingsForm } from "./whatsapp-template-settings-form";
import { saveChatSettingsAction, saveRoleFeaturesAction, updateCourierButtonsAction } from "./actions";
import { useRouter } from "next/navigation";
import { RoleFeaturesConfig } from "@/lib/role-features-settings";
import { CourierButtonsSettings } from "./courier-buttons-settings";
import { TelegramBotsForm } from "./telegram-bots-form";

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

function ChevronIcon({ open, icons }: { open: boolean, icons: GlobalIconsConfig }) {
  return (
    <DynamicIcon
      iconKey="ui_arrow_right"
      config={icons}
      className={`h-5 w-5 transition duration-200 ${open ? "-rotate-90" : "rotate-90"}`}
      fallback={
        <svg
          className={`h-5 w-5 transition duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.4}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      }
    />
  );
}

function Block({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
  icons,
  tone = "sky",
}: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icons: GlobalIconsConfig;
  tone?: "sky" | "emerald" | "amber" | "rose" | "indigo";
}) {
  const toneClasses = useMemo(() => {
    switch (tone) {
      case "emerald":
        return {
          border: "border-emerald-200/90",
          focus: "focus-visible:ring-emerald-300/60",
          badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
          hover: "hover:border-emerald-300 hover:shadow-emerald-200/40",
        };
      case "amber":
        return {
          border: "border-amber-200/90",
          focus: "focus-visible:ring-amber-300/60",
          badge: "bg-amber-50 text-amber-800 border-amber-200",
          hover: "hover:border-amber-300 hover:shadow-amber-200/40",
        };
      case "rose":
        return {
          border: "border-rose-200/90",
          focus: "focus-visible:ring-rose-300/60",
          badge: "bg-rose-50 text-rose-800 border-rose-200",
          hover: "hover:border-rose-300 hover:shadow-rose-200/40",
        };
      case "indigo":
        return {
          border: "border-indigo-200/90",
          focus: "focus-visible:ring-indigo-300/60",
          badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
          hover: "hover:border-indigo-300 hover:shadow-indigo-200/40",
        };
      default:
        return {
          border: "border-sky-200/90",
          focus: "focus-visible:ring-sky-300/60",
          badge: "bg-sky-50 text-sky-800 border-sky-200",
          hover: "hover:border-sky-300 hover:shadow-sky-200/40",
        };
    }
  }, [tone]);

  return (
    <section id={id} className={`rounded-2xl border bg-white shadow-sm ${toneClasses.border}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className={`group flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-4 text-start outline-none transition hover:-translate-y-[1px] hover:shadow-md ${toneClasses.hover} ${toneClasses.focus} focus-visible:ring-2 sm:px-5`}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-slate-900">{title}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneClasses.badge}`}
            >
              {open ? "مفتوح" : "مغلق"}
            </span>
          </span>
          {subtitle ? (
            <span className="mt-1 block text-sm leading-relaxed text-slate-600">{subtitle}</span>
          ) : null}
        </span>
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition group-hover:bg-slate-50">
          <ChevronIcon open={open} icons={icons} />
        </span>
      </button>

      <div
        id={`${id}-panel`}
        className={`${open ? "block" : "hidden"} border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5`}
      >
        {children}
      </div>
    </section>
  );
}

export function SettingsBlocks({
  notificationInitial,
  globalIcons,
  employeeShareTemplate,
  customerOrderTemplate,
  telegramNewOrderTemplate,
  chatEnabledInitial,
  mandoubFeaturesInitial,
  preparerFeaturesInitial,
  telegramAdminsInitial,
  telegramBotsInitial,
}: {
  notificationInitial: NotificationInitial;
  globalIcons: GlobalIconsConfig;
  employeeShareTemplate: string;
  customerOrderTemplate: string;
  telegramNewOrderTemplate: string;
  chatEnabledInitial: boolean;
  mandoubFeaturesInitial: RoleFeaturesConfig;
  preparerFeaturesInitial: RoleFeaturesConfig;
  telegramAdminsInitial: Array<{ id: string; telegramUserId: string; name: string; active: boolean }>;
  telegramBotsInitial: any[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string>("ui-designer");
  const [chatEnabled, setChatEnabled] = useState(chatEnabledInitial);
  const [chatSaving, setChatSaving] = useState(false);

  const [mandoubFeatures, setMandoubFeatures] = useState(mandoubFeaturesInitial);
  const [preparerFeatures, setPreparerFeatures] = useState(preparerFeaturesInitial);
  const [roleFeaturesSaving, setRoleFeaturesSaving] = useState(false);

  const [howToShopUrl, setHowToShopUrl] = useState("");
  const [productCardBgUrl, setProductCardBgUrl] = useState("");
  const [productCardBgOpacity, setProductCardBgOpacity] = useState(40);
  const [storeOrdersExcelEnabled, setStoreOrdersExcelEnabled] = useState(true);
  const [aiEnabledStore, setAiEnabledStore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (openId === "store-settings") {
      fetch("/api/admin/settings/store")
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
        })
        .catch(err => console.error("Failed to load store settings:", err));
    }
  }, [openId]);

  const [telegramAdminIds, setTelegramAdminIds] = useState(notificationInitial.telegramAdminIds);
  const [telegramBots, setTelegramBots] = useState(telegramBotsInitial);
  const [telegramSaving, setTelegramSaving] = useState(false);

  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Block
        id="telegram-bots"
        title="بوتات تليجرام 🤖"
        subtitle="إضافة وإدارة بوتات النظام المتعددة."
        open={openId === "telegram-bots"}
        onToggle={() => setOpenId((x) => (x === "telegram-bots" ? "" : "telegram-bots"))}
        tone="indigo"
        icons={globalIcons}
      >
        <TelegramBotsForm initialBots={telegramBots} icons={globalIcons} />
      </Block>

      <Block
        id="telegram-admins"
        title="مدراء البوت 🤖"
        subtitle="تحديد الـ IDs المسموح لها بالتحكم بالبوت."
        open={openId === "telegram-admins"}
        onToggle={() => setOpenId((x) => (x === "telegram-admins" ? "" : "telegram-admins"))}
        tone="indigo"
        icons={globalIcons}
      >
        <div className="space-y-6">
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h3 className="text-xs font-black text-slate-800">إضافة مدير جديد</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                placeholder="Telegram ID"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
              />
              <input
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="الاسم المستعار"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
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
      </Block>

      <Block
        id="courier-buttons"
        title="أزرار المندوب ⚡"
        subtitle="تحكم في الأزرار التي تظهر للمندوب."
        open={openId === "courier-buttons"}
        onToggle={() => setOpenId((x) => (x === "courier-buttons" ? "" : "courier-buttons"))}
        tone="indigo"
        icons={globalIcons}
      >
        <CourierButtonsSettings />
      </Block>

      <Block
        id="role-features"
        title="مميزات الأدوار 🛠️"
        subtitle="أزرار الدردشة والذكاء الاصطناعي."
        open={openId === "role-features"}
        onToggle={() => setOpenId((x) => (x === "role-features" ? "" : "role-features"))}
        tone="indigo"
        icons={globalIcons}
      >
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
      </Block>

      <Block
        id="chat-settings"
        title="نظام الدردشة 💬"
        subtitle="تشغيل أو إيقاف المحادثات."
        open={openId === "chat-settings"}
        onToggle={() => setOpenId((x) => (x === "chat-settings" ? "" : "chat-settings"))}
        tone="indigo"
        icons={globalIcons}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
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
                className="mt-1 h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-black text-slate-800">تفعيل نظام الدردشة</span>
              </span>
            </label>
          </div>
        </div>
      </Block>

      <Block
        id="icon-settings"
        title="الأيقونات 🎭"
        subtitle="تحكم في شكل واجهة التحميل."
        open={openId === "icon-settings"}
        onToggle={() => setOpenId((x) => (x === "icon-settings" ? "" : "icon-settings"))}
        tone="sky"
        icons={globalIcons}
      >
        <IconSettingsForm initial={globalIcons} />
      </Block>

      <Block
        id="store-settings"
        title="إعدادات المتجر 🛒"
        subtitle="روابط وتخصيصات واجهة الزبائن."
        open={openId === "store-settings"}
        onToggle={() => setOpenId((x) => (x === "store-settings" ? "" : "store-settings"))}
        tone="indigo"
        icons={globalIcons}
      >
        <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const formData = new FormData(e.currentTarget);
            try {
                const res = await fetch('/api/admin/settings/store', {
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
              <label className="text-xs font-bold text-slate-700">رابط "طريقة التسوق"</label>
              <input name="how_to_shop_url" value={howToShopUrl} onChange={(e) => setHowToShopUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">خلفية المنتج</label>
              <input type="file" name="product_card_bg_file" accept="image/*" className="w-full text-xs" />
            </div>
            <button disabled={loading} className="w-full py-2 bg-violet-600 text-white font-bold rounded-xl text-sm">{loading ? "جاري..." : "حفظ"}</button>
          </div>
        </form>
      </Block>

      <Block
        id="ui-designer"
        title="مصمم الواجهات 🎨"
        subtitle="الألوان والصور والترتيب."
        open={openId === "ui-designer"}
        onToggle={() => setOpenId((x) => (x === "ui-designer" ? "" : "ui-designer"))}
        tone="indigo"
        icons={globalIcons}
      >
        <Link href="/admin/settings/ui-designer" className="block p-4 text-center bg-indigo-50 border border-indigo-200 rounded-2xl font-black text-indigo-700 hover:bg-indigo-100 transition">
           فتح المصمم الذكي ←
        </Link>
      </Block>

      <Block
        id="pricing-config"
        title="التسعير والأنواع 💰"
        subtitle="اللحوم والأسماك والأسعار."
        open={openId === "pricing-config"}
        onToggle={() => setOpenId((x) => (x === "pricing-config" ? "" : "pricing-config"))}
        tone="amber"
        icons={globalIcons}
      >
        <PricingSettingsForm />
      </Block>

      <Block
        id="whatsapp"
        title="إعدادات واتساب 📱"
        subtitle="النماذج والأزرار."
        open={openId === "whatsapp"}
        onToggle={() => setOpenId((x) => (x === "whatsapp" ? "" : "whatsapp"))}
        tone="emerald"
        icons={globalIcons}
      >
        <WhatsappTemplateSettingsForm initialEmployeeTemplate={employeeShareTemplate} initialCustomerTemplate={customerOrderTemplate} initialTelegramTemplate={telegramNewOrderTemplate} />
      </Block>

      <Block
        id="notifications"
        title="الإشعارات 🔔"
        subtitle="النصوص، النغمات، والتشغيل."
        open={openId === "notifications"}
        onToggle={() => setOpenId((x) => (x === "notifications" ? "" : "notifications"))}
        tone="sky"
        icons={globalIcons}
      >
        <NotificationSettingsForm initial={notificationInitial} />
      </Block>

      <Block
        id="purge-demo"
        title="المسح النهائي ⚠️"
        subtitle="تصفير شامل للبيانات."
        open={openId === "purge-demo"}
        onToggle={() => setOpenId((x) => (x === "purge-demo" ? "" : "purge-demo"))}
        tone="rose"
        icons={globalIcons}
      >
        <PurgeDemoDataForm />
      </Block>
    </div>
  );
}
