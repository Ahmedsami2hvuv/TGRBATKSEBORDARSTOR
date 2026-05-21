import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SlideManager } from "./_components/slide-manager";
import { SlideForm } from "./_components/slide-form";

export default async function AdminSlidesPage() {
  const slides = await prisma.storeSlide.findMany({
    orderBy: { sequence: "asc" },
  });

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">إدارة السلايدر</h1>
          <p className="text-slate-500 font-bold">إضافة وتعديل صور السلايدر في واجهة المتجر</p>
        </div>
        <Link href="/abo1stor3hlaa2kbr8-47/store" className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-sm">
          عودة
        </Link>
      </div>

      <SlideForm />

      <SlideManager initialSlides={JSON.parse(JSON.stringify(slides))} />
    </div>
  );
}
