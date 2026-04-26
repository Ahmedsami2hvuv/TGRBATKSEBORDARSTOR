"use client";

import { useMemo, useState } from "react";

type Audience = "admin" | "mandoub" | "employee" | "customer";

const LABELS: Record<Audience, string> = {
  admin: "الإدارة (كل الأجهزة المسجّلة)",
  mandoub: "المندوبين (كل الأجهزة المسجّلة)",
  /** اشتراكات Web Push لرابط «رفع الطلب» — موظفو المحل فقط، وليس فريق المجهزين عند الإدارة */
  employee: "موظفو المحل (رابط رفع الطلب — Web Push)",
  customer: "العملاء (الأجهزة المفعّلة برابط الإدارة)",
};

export function TestPushNotificationsForm() {
  const [admin, setAdmin] = useState(true);
  const [mandoub, setMandoub] = useState(true);
  const [employee, setEmployee] = useState(true);
  const [customer, setCustomer] = useState(false);
  const [title, setTitle] = useState("اختبار إشعار");
  const [body, setBody] = useState("هذا إشعار تجريبي من لوحة الإدارة.");
  const [customerId, setCustomerId] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [linkPending, setLinkPending] = useState(false);

  const audiences = useMemo((): Audience[] => {
    const a: Audience[] = [];
    if (admin) a.push("admin");
    if (mandoub) a.push("mandoub");
    if (employee) a.push("employee");
    if (customer) a.push("customer");
    return a;
  }, [admin, mandoub, employee, customer]);

  async function sendTest() {
    setResult(null);
    if (audiences.length === 0) {
      setResult("اختر جهة واحدة على الأقل.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/admin/test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title, body, audiences }),
      });
      const data = (await res.json()) as {
        counts?: Record<Audience, number>;
        vapidConfigured?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setResult(data.error === "no_audiences" ? "لم تُختر جهة." : "تعذّر الإرسال.");
        return;
      }
      if (!data.vapidConfigured) {
        setResult("مفاتيح VAPID غير مضبوطة على الخادم.");
        return;
      }
      const c = data.counts;
      if (c) {
        setResult(
          `تم الطلب. أجهزة مستهدفة تقريبياً: إدارة ${c.admin}، مندوب ${c.mandoub}، موظف محل (Web Push) ${c.employee}، عميل ${c.customer}. (صفر يعني لا يوجد اشتراك مسجّل لتلك الجهة.)`,
        );
      } else {
        setResult("تم الإرسال.");
      }
    } catch {
      setResult("خطأ شبكة.");
    } finally {
      setPending(false);
    }
  }

  async function generateCustomerLink() {
    setGeneratedLink(null);
    const id = customerId.trim();
    if (!id) {
      setGeneratedLink(null);
      return;
    }
    setLinkPending(true);
    try {
      const res = await fetch(
        `/api/admin/customer-push-link?customerId=${encodeURIComponent(id)}`,
        { credentials: "same-origin" },
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setGeneratedLink(data.error === "not_found" ? "معرّف الزبون غير موجود." : "تعذّر إنشاء الرابط.");
        return;
      }
      if (data.url) setGeneratedLink(data.url);
    } catch {
      setGeneratedLink("خطأ شبكة.");
    } finally {
      setLinkPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <h3 className="text-base font-bold text-slate-900">اختبار إشعارات الدفع (Web Push)</h3>
      <p className="text-xs text-slate-600">
        يُرسل إشعاراً حقيقياً للأجهزة التي سبق أن فعّلت «إشعارات المتصفح» لكل فئة. إن كان العدد 0 فلا يوجد
        اشتراك بعد لتلك الفئة.
      </p>
      <p className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-[11px] font-semibold leading-relaxed text-sky-950">
        «موظفو المحل» هنا = من يفتح رابط المحل لرفع الطلب.{" "}
        <strong className="text-slate-900">المجهزون</strong> فريق عند الإدارة ولهم قسم منفصل — ليسوا نفس
        الفئة ولا يُسمّون موظفي محل.
      </p>

      <div className="grid gap-2 text-sm font-semibold text-slate-800">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          {LABELS.admin}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={mandoub} onChange={(e) => setMandoub(e.target.checked)} />
          {LABELS.mandoub}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={employee} onChange={(e) => setEmployee(e.target.checked)} />
          {LABELS.employee}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={customer} onChange={(e) => setCustomer(e.target.checked)} />
          {LABELS.customer}
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">عنوان الإشعار</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-600">نص الإشعار</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </label>

      <button
        type="button"
        disabled={pending}
        onClick={sendTest}
        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "جارٍ الإرسال…" : "إرسال اختبار"}
      </button>

      {result ? (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">{result}</p>
      ) : null}

      <div className="border-t border-amber-200 pt-4">
        <p className="text-xs font-bold text-slate-700">رابط تفعيل إشعارات عميل (معرّف Customer من قاعدة البيانات)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="معرّف الزبون (cuid)"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            disabled={linkPending}
            onClick={generateCustomerLink}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {linkPending ? "…" : "إنشاء رابط"}
          </button>
        </div>
        {generatedLink ? (
          <p className="mt-2 break-all rounded-lg bg-white p-2 text-xs text-slate-700">{generatedLink}</p>
        ) : null}
      </div>
    </div>
  );
}
