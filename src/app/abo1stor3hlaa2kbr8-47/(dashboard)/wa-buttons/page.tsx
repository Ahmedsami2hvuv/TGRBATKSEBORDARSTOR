import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WaButtonsList } from "./wa-buttons-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إعدادات أزرار واتساب — KSEBORDARSTOR",
};

export default async function WaButtonsPage() {
  const rows = await prisma.mandoubWaButtonSetting.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* الترويسة الرئيسية */}
      <div className="rounded-3xl border border-sky-150 bg-gradient-to-r from-sky-50 via-white to-cyan-50/40 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-500 text-3xl shadow-sm text-white">
              💬
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                إعدادات أزرار ونماذج واتساب
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                أنشئ وأدر أزرار واتساب للمناديب والإدارة والمجهزين مع نماذج رسائل جاهزة وتعديل فوري وسلس.
              </p>
            </div>
          </div>

          <Link
            href="/abo1stor3hlaa2kbr8-47/wa-buttons/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-700 hover:to-teal-700 active:scale-95"
          >
            <span>➕</span>
            <span>إضافة زر واتساب جديد</span>
          </Link>
        </div>
      </div>

      {/* قائمة الأزرار */}
      <section>
        <WaButtonsList rows={rows} />
      </section>
    </div>
  );
}

