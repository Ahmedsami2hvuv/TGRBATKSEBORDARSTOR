import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import Link from "next/link";
import { WaButtonsList } from "./wa-buttons-list";

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
          <WaButtonsList rows={rows} />
        </div>
      </section>
    </div>
  );
}
