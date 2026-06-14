import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import Link from "next/link";
import { deleteMandoubWaButton, duplicateMandoubWaButton } from "./actions";
import {
  parseLocationRulesCsv,
  parseStatusesCsv,
  parseVisibilityScopesCsv,
} from "./wa-buttons-constants";
import { splitMandoubWaTemplateVariants } from "@/lib/mandoub-wa-button-template";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إعدادات واتساب — KSEBORDARSTOR",
};

export default async function WaButtonsPage() {
  const rows = await prisma.mandoubWaButtonSetting.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={ad.h1}>إعدادات أزرار واتساب</h1>
          <p className={ad.lead}>
            أنشئ وأدر أزرار واتساب المندوب والمجهزين لتسهيل التواصل وإرسال الرسائل الجاهزة.
          </p>
        </div>
        <Link
          href="/abo1stor3hlaa2kbr8-47/wa-buttons/new"
          className={ad.btnPrimary}
        >
          ➕ إضافة زر واتساب جديد
        </Link>
      </div>

      <section className={ad.section}>
        <div className="space-y-4">
          <h2 className={ad.h2}>قائمة الأزرار المعرّفة</h2>
          <div className="space-y-3">
            {rows.length ? (
              rows.map((r) => {
                const variants = splitMandoubWaTemplateVariants(r.templateText);
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-sky-100 bg-white p-4 transition duration-200 hover:border-sky-200 hover:shadow-sm sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-1 items-start gap-4 min-w-[280px]">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-2xl">
                          {r.iconKey}
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-slate-900">
                            {r.label}
                          </h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>
                              <strong>الحالات:</strong>{" "}
                              {r.statusesCsv
                                ? parseStatusesCsv(r.statusesCsv).join(", ")
                                : "—"}
                            </span>
                            <span>
                              <strong>الظهور للـ:</strong>{" "}
                              {parseVisibilityScopesCsv(r.visibilityScope).join(" / ")}
                            </span>
                            <span>
                              <strong>لوكيشن الزبون:</strong>{" "}
                              {parseLocationRulesCsv(r.customerLocationRule)
                                .map((v) =>
                                  v === "any"
                                    ? "الكل"
                                    : v === "exists"
                                      ? "موجود لوكيشن"
                                      : v === "missing"
                                        ? "بدون لوكيشن"
                                        : "لوكيشن مرفوع من المندوب (GPS)",
                                )
                                .join(" / ")}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            {variants.length === 0 ? (
                              <span className="text-amber-800 font-medium">
                                ⚠️ لا توجد نماذج رسالة بعد. اضغط «تعديل وإدارة النماذج» لإعداد الرسائل.
                              </span>
                            ) : (
                              <div className="rounded-lg bg-slate-50 p-2.5 text-xs font-mono border border-slate-100 mt-1 max-w-xl">
                                <span className="text-slate-500 block font-bold mb-1">
                                  صيغة الرسالة (عدد النماذج: {variants.length}):
                                </span>
                                <p className="line-clamp-2 whitespace-pre-wrap text-slate-700">
                                  {variants[0]}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/abo1stor3hlaa2kbr8-47/wa-buttons/${r.id}`}
                          className={ad.btnPrimary}
                        >
                          تعديل وإدارة النماذج
                        </Link>

                        <form action={duplicateMandoubWaButton}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className={ad.btnDark}>
                            نسخ
                          </button>
                        </form>

                        <form
                          action={deleteMandoubWaButton}
                          onSubmit={(e) => {
                            if (!window.confirm("حذف هذا الزر نهائياً؟")) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className={ad.btnDanger}>
                            حذف
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className={ad.muted}>لا توجد أزرار بعد. أضف أول زر للبدء.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
