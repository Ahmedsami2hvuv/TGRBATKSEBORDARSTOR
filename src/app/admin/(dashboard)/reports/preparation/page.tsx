import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { formatYMDLocal } from "@/lib/report-dates";
import { ReportTableClient } from "./report-table-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "تقارير التجهيز حسب اليوم — أبو الأكبر للتوصيل",
};

// كلمات الاستبعاد (للتأكيد)
const STRICT_EXCLUDE = ["همبركر", "بركر", "كبة", "كبه", "نعناع", "كرفس", "فجل"];

export default async function PreparationReportPage({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const dayParam = sp.day;

  // جلب إعدادات التسعير والأنواع من قاعدة البيانات
  const pricingSetting = await prisma.uISystemSetting.findUnique({
    where: { target_section: { target: "system", section: "pricing_config" } }
  });
  const pricingConfig = (pricingSetting?.config as any) || {};

  const meatWhitelist = pricingConfig.meat_keywords || ["شرح", "مثروم", "ضلوع", "عظم", "عضم", "فكارة", "فكاره", "عصفورة", "عصفوره", "شحم", "باجة", "باجه", "كراعين"];
  const fishWhitelist = pricingConfig.fish_keywords || [
    "سمك", "ابياح", "برطام", "بنت السلطان", "بني", "بياح", "جش", "حيسون", "حمار", "حمر", "حمرة", "حمره",
    "خشرة", "خشره", "دوكان", "روبيان", "ربيان", "سمتي", "سمكة", "سلمون", "سلمونة", "سلمونه", "سلمنتين",
    "شانگ", "شانك", "شعري", "شلك", "صافي", "ضلعة", "ضلعه", "ظلعة", "ظلعه", "عندك", "عندگ", "عروسة",
    "عروسه", "غريبة", "غريبه", "كطان", "مزلك", "مزلگ", "ملزك", "نگرور", "نكرور", "وحر", "هامور"
  ];

  const now = new Date();
  const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
  if (now < shiftStart) shiftStart.setDate(shiftStart.getDate() - 1);
  const defaultDay = formatYMDLocal(shiftStart);
  
  const selectedDayIso = (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) ? dayParam : defaultDay;
  const parts = selectedDayIso.split("-").map(Number);
  const selectedDayDate = new Date(parts[0], parts[1] - 1, parts[2]);

  const from = new Date(selectedDayDate.getFullYear(), selectedDayDate.getMonth(), selectedDayDate.getDate(), 6, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  to.setMilliseconds(to.getMilliseconds() - 1);

  const dayList = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(shiftStart);
    d.setDate(d.getDate() - i);
    return formatYMDLocal(d);
  });

  const orders = await prisma.order.findMany({
    where: { 
      createdAt: { gte: from, lte: to }, 
      preparerShoppingJson: { not: null },
      status: { notIn: ["cancelled", "rejected"] }
    },
    orderBy: { createdAt: "desc" },
    include: { shop: { select: { name: true } }, customerRegion: { select: { name: true } } },
  });

  const orderSummaries = orders.map((order) => {
    const json = order.preparerShoppingJson as any;
    const products = Array.isArray(json?.products) ? json.products : [];
    
    const totalProfit = products.reduce((sum: number, p: any) => sum + (Number(p.sellAlf) - Number(p.buyAlf) || 0), 0);

    // دالة الفحص المرنة: تنظف السطر من الأرقام والوحدات ثم تفحص البداية
    const checkIsTypeFlexible = (line: string, whitelist: string[]) => {
      const clean = line.toLowerCase()
        .replace(/[0-9٠-٩]/g, '') // حذف الأرقام
        .replace(/\b(كيلو|كغم|ك|غم|غرام|نص|نصف|ربع|عدد)\b/g, '') // حذف الوحدات
        .trim();
      
      // نأخذ أول 15 حرف من النص النظيف للتأكد أن النوع هو الأساسي
      const startOfLine = clean.slice(0, 15);
      return whitelist.some(item => startOfLine.includes(item.toLowerCase()));
    };

    const meatProducts = products.filter((p: any) => {
      const line = p.line || "";
      return checkIsTypeFlexible(line, meatWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
    });

    const fishProducts = products.filter((p: any) => {
      const line = p.line || "";
      return checkIsTypeFlexible(line, fishWhitelist) && !STRICT_EXCLUDE.some(ex => line.toLowerCase().includes(ex));
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
      regionName: order.customerRegion?.name ?? "غير معروف",
      totalProfitAlf: totalProfit,
      hasMeat: meatProducts.length > 0,
      meatBuyAlf: meatProducts.reduce((sum, p) => sum + Number(p.buyAlf), 0),
      meatSellAlf: meatProducts.reduce((sum, p) => sum + Number(p.sellAlf), 0),
      meatProfitAlf: meatProducts.reduce((sum, p) => sum + (Number(p.sellAlf) - Number(p.buyAlf)), 0),
      meatProductsList: meatProducts,
      hasFish: fishProducts.length > 0,
      fishBuyAlf: fishProducts.reduce((sum, p) => sum + Number(p.buyAlf), 0),
      fishSellAlf: fishProducts.reduce((sum, p) => sum + Number(p.sellAlf), 0),
      fishProfitAlf: fishProducts.reduce((sum, p) => sum + (Number(p.sellAlf) - Number(p.buyAlf)), 0),
      fishProductsList: fishProducts,
      preparerShoppingJson: json
    };
  });

  const totalProfit = orderSummaries.reduce((sum, o) => sum + o.totalProfitAlf, 0);
  const totalMeatProfit = orderSummaries.reduce((sum, o) => sum + o.meatProfitAlf, 0);
  const totalFishProfit = orderSummaries.reduce((sum, o) => sum + o.fishProfitAlf, 0);

  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}><Link href="/admin/reports" className={ad.link}>← التقارير</Link></p>
      
      <div className="flex flex-wrap gap-3">
        <div className="rounded-2xl bg-slate-900 text-white px-4 py-2 text-xs font-black shadow-md border-b-4 border-slate-700">
          إجمالي الأرباح: {formatDinarAsAlfWithUnit(totalProfit * ALF_PER_DINAR)}
        </div>
        <div className="rounded-2xl bg-red-900 text-white px-4 py-2 text-xs font-black shadow-md border-b-4 border-red-950">
          أرباح اللحوم: {formatDinarAsAlfWithUnit(totalMeatProfit * ALF_PER_DINAR)}
        </div>
        <div className="rounded-2xl bg-sky-900 text-white px-4 py-2 text-xs font-black shadow-md border-b-4 border-sky-950">
          أرباح الأسماك: {formatDinarAsAlfWithUnit(totalFishProfit * ALF_PER_DINAR)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm h-fit">
          <h2 className="text-sm font-black text-slate-400 mb-3 px-2 uppercase italic tracking-widest">تاريخ التقرير</h2>
          {dayList.map((day) => (
            <Link key={day} href={`/admin/reports/preparation?day=${day}`} className={`block rounded-2xl px-4 py-3 text-sm font-bold transition-all ${day === selectedDayIso ? "bg-slate-900 text-white shadow-lg scale-[1.02]" : "text-slate-600 hover:bg-slate-50"}`}>
              {day} {day === defaultDay && "⭐"}
            </Link>
          ))}
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black mb-4 border-b pb-2">خلاصة يوم {selectedDayIso}</h2>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                <p className="text-[10px] font-black text-emerald-600 uppercase">ربح اليوم الصافي</p>
                <p className="mt-1 text-xl font-black text-emerald-700">{formatDinarAsAlfWithUnit(totalProfit * ALF_PER_DINAR)}</p>
              </div>
              <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-center">
                <p className="text-[10px] font-black text-red-600 uppercase">أرباح القصاب 🥩</p>
                <p className="mt-1 text-xl font-black text-red-700">{formatDinarAsAlfWithUnit(totalMeatProfit * ALF_PER_DINAR)}</p>
              </div>
              <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-center">
                <p className="text-[10px] font-black text-sky-600 uppercase">أرباح السماك 🐟</p>
                <p className="mt-1 text-xl font-black text-sky-700">{formatDinarAsAlfWithUnit(totalFishProfit * ALF_PER_DINAR)}</p>
              </div>
            </div>
          </div>

          <ReportTableClient orders={orderSummaries} />
        </div>
      </div>
    </div>
  );
}
