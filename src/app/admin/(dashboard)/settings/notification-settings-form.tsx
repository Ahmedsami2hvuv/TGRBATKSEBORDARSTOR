"use client";

import { useActionState } from "react";
import {
  NOTIFICATION_SOUND_PRESET_IDS,
  NOTIFICATION_SOUND_PRESET_LABELS_AR,
  type NotificationSoundPresetId,
} from "@/lib/notification-sound-presets";
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
  };
};

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
            >
              {NOTIFICATION_SOUND_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {NOTIFICATION_SOUND_PRESET_LABELS_AR[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص الإشعار عند طلب واحد جديد (يدعم {`{orderNumber}`})
            </span>
            <input
              name="adminTemplateSingle"
              defaultValue={initial.adminTemplateSingle}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص الإشعار عند عدة طلبات جديدة (يدعم {`{count}`})
            </span>
            <input
              name="adminTemplateMultiple"
              defaultValue={initial.adminTemplateMultiple}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-200 bg-white/70 p-4">
        <h3 className="text-base font-bold text-slate-900">إشعارات المندوب</h3>
        <div className="mt-3 grid gap-3">
          {/* تم إخفاء خيار تفعيل/تعطيل إشعارات الإسناد للمندوب */}
          <input type="hidden" name="mandoubEnabled" value="off" />
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
            >
              {NOTIFICATION_SOUND_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {NOTIFICATION_SOUND_PRESET_LABELS_AR[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص الإشعار عند إسناد طلب واحد (يدعم {`{orderNumber}`})
            </span>
            <input
              name="mandoubTemplateSingle"
              defaultValue={initial.mandoubTemplateSingle}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">
              نص الإشعار عند إسناد عدة طلبات (يدعم {`{count}`})
            </span>
            <input
              name="mandoubTemplateMultiple"
              defaultValue={initial.mandoubTemplateMultiple}
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
