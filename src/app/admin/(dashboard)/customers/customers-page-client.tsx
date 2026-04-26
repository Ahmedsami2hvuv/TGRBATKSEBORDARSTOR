"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ad } from "@/lib/admin-ui";
import { CustomerPhoneRows, type CustomerPhoneRowUi } from "./customer-phone-rows";
import { CustomerProfileUpsertForm } from "./profiles/customer-profile-upsert-form";

type RegionOption = { id: string; name: string };
type ProfileRow = {
  id: string;
  phone: string;
  regionName: string;
  locationUrl: string;
  landmark: string;
  alternatePhone: string | null;
  notes: string;
  photoUrl: string;
};

export function CustomersPageClient({
  rows,
  regionOptions,
  profiles,
  currentPage,
  totalPages,
  initialQuery = "",
}: {
  rows: CustomerPhoneRowUi[];
  regionOptions: RegionOption[];
  profiles: ProfileRow[];
  currentPage: number;
  totalPages: number;
  initialQuery?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [showProfiles, setShowProfiles] = useState(false);
  const formSectionRef = useRef<HTMLDivElement>(null);

  // تحديث البحث عند ضغط Enter أو الضغط على زر البحث
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    params.set("page", "1"); // العودة للصفحة الأولى عند البحث
    router.push(`/admin/customers?${params.toString()}`);
  };

  // التمرير التلقائي عند فتح نموذج الإضافة
  useEffect(() => {
    if (showProfiles && formSectionRef.current) {
      formSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showProfiles]);

  // بناء أرقام الصفحات المعروضة
  const pageNumbers = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  // دالة بناء رابط الصفحة مع الحفاظ على البحث
  const getPageLink = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", p.toString());
    return `/admin/customers?${params.toString()}`;
  };

  return (
    <>
      <section className={`${ad.section} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={ad.h2}>قائمة الزبائن</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowProfiles((v) => !v)}
              className={`${ad.btnPrimary} shadow-md`}
            >
              {showProfiles ? "إخفاء الإضافة" : "إضافة زبون مرجعي"}
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <label className="block flex-1">
            <span className={ad.label}>بحث في كافة الزبائن</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="رقم الهاتف، المنطقة، أو نقطة دالة..."
              className={`${ad.input} mt-1`}
            />
          </label>
          <button type="submit" className={`${ad.btnDark} mt-auto h-[42px]`}>
            بحث
          </button>
        </form>
      </section>

      <div className={ad.section}>
        <CustomerPhoneRows rows={rows} />

        {/* أزرار الترقيم */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-4">
            {currentPage > 1 && (
              <Link href={getPageLink(currentPage - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                السابق
              </Link>
            )}

            {startPage > 1 && <span className="text-slate-400">...</span>}

            {pageNumbers.map(p => (
              <Link
                key={p}
                href={getPageLink(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold shadow-sm ${p === currentPage ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {p}
              </Link>
            ))}

            {endPage < totalPages && <span className="text-slate-400">...</span>}

            {currentPage < totalPages && (
              <Link href={getPageLink(currentPage + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                التالي
              </Link>
            )}
          </div>
        )}

        <p className="mt-3 text-center text-xs font-medium text-slate-500">
          صفحة {currentPage} من {totalPages}
        </p>
      </div>

      {showProfiles && (
        <div ref={formSectionRef} className="scroll-mt-6">
          <section id="profiles" className={`${ad.section} space-y-4 border-t-4 border-sky-500 bg-sky-50/30`}>
            <div>
              <h2 className={ad.h2}>إضافة تفاصيل زبون</h2>
              <p className="text-xs text-slate-500">أدخل بيانات الزبون المرجعية ليتم حفظها في النظام.</p>
            </div>
            <CustomerProfileUpsertForm regions={regionOptions} />
          </section>

          <section className={ad.section}>
            <h2 className={ad.h2}>السجلات المرجعية (في هذه الصفحة)</h2>
            {profiles.length === 0 ? (
              <p className="mt-3 text-center text-slate-600">
                لا توجد تفاصيل محفوظة لهؤلاء الزبائن.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-sky-200 text-right text-xs text-slate-500">
                      <th className="pb-2 pe-2 font-medium">الهاتف</th>
                      <th className="pb-2 font-medium">المنطقة</th>
                      <th className="pb-2 font-medium">لوكيشن</th>
                      <th className="pb-2 font-medium w-28">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 text-slate-800 align-top">
                        <td className="py-2 pe-2 font-mono tabular-nums">{p.phone}</td>
                        <td className="py-2">{p.regionName}</td>
                        <td className="py-2">
                          {p.locationUrl ? <span className="text-emerald-600">✔ موجود</span> : "—"}
                        </td>
                        <td className="py-2">
                          <Link href={`/admin/customers/profiles/${p.id}/edit`} className={ad.link}>
                            تعديل
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
