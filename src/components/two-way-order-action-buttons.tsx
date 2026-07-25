"use client";

import { useState } from "react";
import {
  whatsappMeUrl,
  whatsappAppUrl,
  telHref,
  openUrlFromUserGesture,
  digitsOnly,
} from "@/lib/whatsapp";
import {
  renderTwoWayTemplate,
  type TwoWayTemplatesConfig,
  getDefaultTwoWayLocationSenderTemplate,
  getDefaultTwoWayLocationRecipientTemplate,
  getDefaultTwoWayNotifySenderTemplate,
  getDefaultTwoWayNotifyRecipientTemplate,
  getDefaultTwoWayChatSenderTemplate,
  getDefaultTwoWayChatRecipientTemplate,
} from "@/lib/two-way-whatsapp-settings";

export type TwoWayOrderActionButtonsProps = {
  orderId: string;
  orderNumber: string | number;
  routeMode: string;
  // بيانات المرسل
  senderName?: string;
  senderPhone?: string | null;
  senderAlternatePhone?: string | null;
  senderRegionName?: string | null;
  // بيانات المستلم
  recipientName?: string;
  recipientPhone?: string | null;
  recipientAlternatePhone?: string | null;
  recipientRegionName?: string | null;
  // المبالغ والملاحظات
  subtotal?: string | number | null;
  delivery?: string | number | null;
  total?: string | number | null;
  notes?: string | null;
  // القوالب المخصصة (اختياري)
  templates?: Partial<TwoWayTemplatesConfig>;
  // وضع العرض (مدمج في جدول أو في كارت كامل)
  compact?: boolean;
};

export function TwoWayOrderActionButtons({
  orderId,
  orderNumber,
  routeMode,
  senderName = "المرسل",
  senderPhone,
  senderAlternatePhone,
  senderRegionName,
  recipientName = "المستلم",
  recipientPhone,
  recipientAlternatePhone,
  recipientRegionName,
  subtotal = "0",
  delivery = "0",
  total = "0",
  notes = "",
  templates = {},
  compact = false,
}: TwoWayOrderActionButtonsProps) {
  const isDouble = routeMode === "double" || !!recipientPhone;

  // القوالب المعتمدة
  const locSenderTpl = templates.locationSenderTemplate || getDefaultTwoWayLocationSenderTemplate();
  const locRecipientTpl = templates.locationRecipientTemplate || getDefaultTwoWayLocationRecipientTemplate();
  const notSenderTpl = templates.notifySenderTemplate || getDefaultTwoWayNotifySenderTemplate();
  const notRecipientTpl = templates.notifyRecipientTemplate || getDefaultTwoWayNotifyRecipientTemplate();
  const chatSenderTpl = templates.chatSenderTemplate || getDefaultTwoWayChatSenderTemplate();
  const chatRecipientTpl = templates.chatRecipientTemplate || getDefaultTwoWayChatRecipientTemplate();

  // الحالة للنافذة المنبثقة للتعديل والمعاينة
  const [modalOpen, setModalOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  const hasSenderPhone1 = !!digitsOnly(senderPhone);
  const hasSenderPhone2 = !!digitsOnly(senderAlternatePhone);
  const hasRecipientPhone1 = !!digitsOnly(recipientPhone);
  const hasRecipientPhone2 = !!digitsOnly(recipientAlternatePhone);

  const prepareAndOpen = (
    phone: string,
    label: string,
    rawTemplate: string
  ) => {
    const cleanPhone = digitsOnly(phone);
    if (!cleanPhone) return;

    const rendered = renderTwoWayTemplate({
      template: rawTemplate,
      orderNumber,
      senderName,
      senderPhone: senderPhone || "",
      recipientName,
      recipientPhone: recipientPhone || "",
      senderRegion: senderRegionName || "",
      recipientRegion: recipientRegionName || "",
      subtotal: subtotal || "0",
      delivery: delivery || "0",
      total: total || "0",
      notes: notes || "",
    });

    setTargetPhone(cleanPhone);
    setTargetLabel(label);
    setDraftMessage(rendered);
    setModalOpen(true);
  };

  const executeSend = () => {
    if (!targetPhone || !draftMessage) return;
    const url = whatsappMeUrl(targetPhone, draftMessage);
    openUrlFromUserGesture(url);
    setModalOpen(false);
  };

  if (!isDouble && !hasSenderPhone1 && !hasRecipientPhone1) {
    return null;
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 p-3 sm:p-4 text-slate-800 shadow-sm">
      <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white shadow-xs">
            ⇄
          </span>
          <span className="text-xs sm:text-sm font-bold text-indigo-950">
            أزرار التواصل والتطبيقات (طلب ذو وجهتين)
          </span>
        </div>
        <span className="rounded-full border border-indigo-200 bg-indigo-100/70 px-2.5 py-0.5 text-[10px] font-black text-indigo-800">
          طلب #{orderNumber}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* --- 1. قسم المرسل (الوجهة الأولى) --- */}
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <span>📤</span> المرسل (الوجهة الأولى)
            </span>
            {senderRegionName && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                📍 {senderRegionName}
              </span>
            )}
          </div>

          {/* المرسل - الرقم الأول */}
          {hasSenderPhone1 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>المرسل الأول: <span className="dir-ltr inline-block text-emerald-800 font-black">{senderPhone}</span></span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => prepareAndOpen(senderPhone!, "واتساب للمرسل الأول", chatSenderTpl)}
                  className="flex-1 min-w-[70px] inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition shadow-2xs"
                >
                  💬 واتساب
                </button>
                <a
                  href={telHref(senderPhone!)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 transition shadow-2xs"
                >
                  📞 اتصال
                </a>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(senderPhone!, "طلب لوكيشن المرسل الأول", locSenderTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-[11px] font-bold text-teal-800 hover:bg-teal-100 transition shadow-2xs"
                >
                  📍 طلب لوكيشن
                </button>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(senderPhone!, "تبليغ المرسل الأول", notSenderTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-100/70 px-2 py-1.5 text-[11px] font-bold text-emerald-900 hover:bg-emerald-200 transition shadow-2xs"
                >
                  🔔 تبليغ
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 font-medium">لا يوجد رقم هاتف للمرسل الأول</p>
          )}

          {/* المرسل - الرقم الثاني (إن وجد) */}
          {hasSenderPhone2 && (
            <div className="space-y-1.5 border-t border-emerald-200/60 pt-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>المرسل الثاني: <span className="dir-ltr inline-block text-emerald-800 font-black">{senderAlternatePhone}</span></span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => prepareAndOpen(senderAlternatePhone!, "واتساب للمرسل الثاني", chatSenderTpl)}
                  className="flex-1 min-w-[70px] inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition shadow-2xs"
                >
                  💬 واتساب 2
                </button>
                <a
                  href={telHref(senderAlternatePhone!)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 transition shadow-2xs"
                >
                  📞 اتصال 2
                </a>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(senderAlternatePhone!, "طلب لوكيشن المرسل الثاني", locSenderTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100 transition shadow-2xs"
                >
                  📍 لوكيشن 2
                </button>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(senderAlternatePhone!, "تبليغ المرسل الثاني", notSenderTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-100/70 px-2 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-200 transition shadow-2xs"
                >
                  🔔 تبليغ 2
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- 2. قسم المستلم (الوجهة الثانية) --- */}
        <div className="rounded-xl border border-blue-200/90 bg-blue-50/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <span>📥</span> المستلم (الوجهة الثانية)
            </span>
            {recipientRegionName && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                📍 {recipientRegionName}
              </span>
            )}
          </div>

          {/* المستلم - الرقم الأول */}
          {hasRecipientPhone1 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>المستلم الأول: <span className="dir-ltr inline-block text-blue-800 font-black">{recipientPhone}</span></span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => prepareAndOpen(recipientPhone!, "واتساب للمستلم الأول", chatRecipientTpl)}
                  className="flex-1 min-w-[70px] inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 transition shadow-2xs"
                >
                  💬 واتساب
                </button>
                <a
                  href={telHref(recipientPhone!)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-blue-800 hover:bg-blue-50 transition shadow-2xs"
                >
                  📞 اتصال
                </a>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(recipientPhone!, "طلب لوكيشن المستلم الأول", locRecipientTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-1.5 text-[11px] font-bold text-cyan-800 hover:bg-cyan-100 transition shadow-2xs"
                >
                  📍 طلب لوكيشن
                </button>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(recipientPhone!, "تبليغ المستلم الأول", notRecipientTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-300 bg-blue-100/70 px-2 py-1.5 text-[11px] font-bold text-blue-900 hover:bg-blue-200 transition shadow-2xs"
                >
                  🔔 تبليغ
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 font-medium">لا يوجد رقم هاتف للمستلم الأول</p>
          )}

          {/* المستلم - الرقم الثاني (إن وجد) */}
          {hasRecipientPhone2 && (
            <div className="space-y-1.5 border-t border-blue-200/60 pt-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>المستلم الثاني: <span className="dir-ltr inline-block text-blue-800 font-black">{recipientAlternatePhone}</span></span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => prepareAndOpen(recipientAlternatePhone!, "واتساب للمستلم الثاني", chatRecipientTpl)}
                  className="flex-1 min-w-[70px] inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition shadow-2xs"
                >
                  💬 واتساب 2
                </button>
                <a
                  href={telHref(recipientAlternatePhone!)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-50 transition shadow-2xs"
                >
                  📞 اتصال 2
                </a>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(recipientAlternatePhone!, "طلب لوكيشن المستلم الثاني", locRecipientTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-1 text-[11px] font-bold text-cyan-800 hover:bg-cyan-100 transition shadow-2xs"
                >
                  📍 لوكيشن 2
                </button>
                <button
                  type="button"
                  onClick={() => prepareAndOpen(recipientAlternatePhone!, "تبليغ المستلم الثاني", notRecipientTpl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-300 bg-blue-100/70 px-2 py-1 text-[11px] font-bold text-blue-900 hover:bg-blue-200 transition shadow-2xs"
                >
                  🔔 تبليغ 2
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Modal / النافذة المنبثقة للتعديل والإرسال --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-indigo-100 bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-indigo-900">
                  إرسال عبر الواتساب: {targetLabel}
                </h4>
                <p className="text-xs text-slate-500">
                  الرقم المستهدف: <span className="dir-ltr inline-block font-bold text-slate-800">{targetPhone}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                محتوى الرسالة (يمكنك تعديله قبل الإرسال):
              </label>
              <textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeSend}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700"
              >
                🚀 فتح الواتساب والإرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
