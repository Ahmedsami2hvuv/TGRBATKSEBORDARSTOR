"use client";

import { useActionState } from "react";
import {
  NOTIFICATION_SOUND_PRESET_IDS,
  NOTIFICATION_SOUND_PRESET_LABELS_AR,
  type NotificationSoundPresetId,
} from "@/lib/notification-sound-presets";
import { playNotificationSound } from "@/lib/notification-sound-client";
import {
  saveNotificationSettings,
  type NotificationSettingsFormState,
} from "./actions";

type NotificationSettingsFormProps = {
  initial: {
    adminEnabled: boolean;
    adminTemplateSingle: string;
    adminTemplateMultiple: string;
    adminSoundEnabled: boolean;
    adminSoundPreset: NotificationSoundPresetId;
    mandoubEnabled: boolean;
    mandoubTemplateSingle: string;
    mandoubTemplateMultiple: string;
    mandoubSoundEnabled: boolean;
    mandoubSoundPreset: NotificationSoundPresetId;
    preparerEnabled: boolean;
    preparerTemplateSingle: string;
    preparerTemplateMultiple: string;
    preparerTemplateWebsite: string;
    preparerSoundEnabled: boolean;
    preparerSoundPreset: NotificationSoundPresetId;
  };
};

type Token = { label: string; token: string };

const TEMPLATE_TOKENS: Token[] = [
  { label: "رقم الطلب", token: "{orderNumber}" },
  { label: "عدد الطلبات", token: "{count}" },
  { label: "اسم المحل", token: "{shopName}" },
  { label: "اسم المنطقة", token: "{regionName}" },
];

function TokenButtons({ target }: { target: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TEMPLATE_TOKENS.map((item) => (
        <button
          key={`${target}-${item.token}`}
          type="button"
          className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>(`input[name="${target}"]`);
            if (!input) return;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            const next =
              input.value.slice(0, start) + item.token + input.value.slice(end);
            input.value = next;
            const cursor = start + item.token.length;
            input.setSelectionRange(cursor, cursor);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
          }}
        >
          + {item.label}
        </button>
      ))}
    </div>
  );
}

export function NotificationSettingsForm({ initial }: NotificationSettingsFormProps) {
  const [state, action, pending] = useActionState(
    saveNotificationSettings,
    {} as NotificationSettingsFormState,
  );

  const inputClass =
    "w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

  return (
    <form action={action} className="space-y-5">
      <section className="rounded-2xl border border-sky-200 bg-white/70 p-4">
        <h3 className="text-base font-bold text-slate-900">إشعارات الإدارة</h3>
        <div className="mt-3 grid gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="adminEnabled" defaultChecked={initial.adminEnabled} />
            تفعيل إشعارات الطلبات الجديدة للإدارة
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="adminSoundEnabled"
              defaultChecked={initial.adminSoundEnabled}
            />
            تفعيل الصوت مع إشعار الإدارة
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">نغمة صوت الإدارة</span>
            <select
              name="adminSoundPreset"
              defaultValue={initial.adminSoundPreset}
              className={inputClass}
              onChange={(e) => playNotificationSound(e.target.value)}
            >
              {NOTIFICATION_SOUND_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {NOTIFICATION_SOUND_PRESET_LABELS_AR[id]}
                </option>
              ))}
            </select>
          </label>
          <TokenButtons target="adminTemplateSingle" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص الإشعار عند طلب جديد
            </span>
            <input
              name="adminTemplateSingle"
              defaultValue={initial.adminTemplateSingle}
              className={inputClass}
            />
          </label>
          <input type="hidden" name="adminTemplateMultiple" defaultValue={initial.adminTemplateMultiple} />
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-200 bg-white/70 p-4">
        <h3 className="text-base font-bold text-slate-900">إشعارات المندوب</h3>
        <div className="mt-3 grid gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="mandoubEnabled" defaultChecked={initial.mandoubEnabled} />
            تفعيل إشعارات إسناد الطلبات للمندوب
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="mandoubSoundEnabled"
              defaultChecked={initial.mandoubSoundEnabled}
            />
            تفعيل الصوت مع إشعار المندوب
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">نغمة صوت المندوب</span>
            <select
              name="mandoubSoundPreset"
              defaultValue={initial.mandoubSoundPreset}
              className={inputClass}
              onChange={(e) => playNotificationSound(e.target.value)}
            >
              {NOTIFICATION_SOUND_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {NOTIFICATION_SOUND_PRESET_LABELS_AR[id]}
                </option>
              ))}
            </select>
          </label>
          <TokenButtons target="mandoubTemplateSingle" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص الإشعار عند إسناد طلب جديد
            </span>
            <input
              name="mandoubTemplateSingle"
              defaultValue={initial.mandoubTemplateSingle}
              className={inputClass}
            />
          </label>
          <input type="hidden" name="mandoubTemplateMultiple" defaultValue={initial.mandoubTemplateMultiple} />
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-white/70 p-4">
        <h3 className="text-base font-bold text-slate-900">إشعارات المجهز</h3>
        <div className="mt-3 grid gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="preparerEnabled" defaultChecked={initial.preparerEnabled} />
            تفعيل إشعارات طلبات التجهيز للمجهز
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="preparerSoundEnabled"
              defaultChecked={initial.preparerSoundEnabled}
            />
            تفعيل الصوت مع إشعار المجهز
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">نغمة صوت المجهز</span>
            <select
              name="preparerSoundPreset"
              defaultValue={initial.preparerSoundPreset}
              className={inputClass}
              onChange={(e) => playNotificationSound(e.target.value)}
            >
              {NOTIFICATION_SOUND_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {NOTIFICATION_SOUND_PRESET_LABELS_AR[id]}
                </option>
              ))}
            </select>
          </label>
          <TokenButtons target="preparerTemplateSingle" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص إشعار طلب التجهيز (من الإدارة)
            </span>
            <input
              name="preparerTemplateSingle"
              defaultValue={initial.preparerTemplateSingle}
              className={inputClass}
            />
          </label>
          <TokenButtons target="preparerTemplateMultiple" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص إشعار طلب جديد من محل مسند للمجهز
            </span>
            <input
              name="preparerTemplateMultiple"
              defaultValue={initial.preparerTemplateMultiple}
              className={inputClass}
            />
          </label>
          <TokenButtons target="preparerTemplateWebsite" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص إشعار طلبات الموقع (Web) المسندة للمجهز
            </span>
            <input
              name="preparerTemplateWebsite"
              defaultValue={initial.preparerTemplateWebsite}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {state.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          تم حفظ إعدادات الإشعارات.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ..." : "حفظ إعدادات الإشعارات"}
      </button>
    </form>
  );
}
