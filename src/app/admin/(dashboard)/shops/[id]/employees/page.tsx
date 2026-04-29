"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { AddEmployeePanel } from "./add-employee-panel";
import { EmployeesList, type EmployeeRow } from "./employees-list";

export default function ShopEmployeesPage() {
  const params = useParams();
  const shopId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<{ id: string; name: string; locationUrl: string } | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/shops/${shopId}/employees`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "فشل تحميل البيانات");
        }

        setShop(data.shop);

        // نستخدم الروابط التي تم توليدها على السيرفر مباشرة لضمان صحة التوقيع
        setEmployees(data.employees);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "حدث خطأ غير متوقع");
      } finally {
        setLoading(false);
      }
    }

    if (shopId) {
      fetchData();
    }
  }, [shopId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">جاري تحميل بيانات الموظفين...</p>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-rose-600 mb-2">حدث خطأ</h2>
          <p className="text-slate-600 mb-4">{error || "البيانات غير متوفرة"}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/shops" className={ad.link}>
          ← المحلات
        </Link>
        <span className="text-slate-400">/</span>
        <span className="font-bold text-slate-800">{shop.name}</span>
      </div>

      <div>
        <h1 className={ad.h1}>موظفي المحل (العملاء الذين يرفعون الطلبات)</h1>
        <p className={`mt-1 ${ad.lead}`}>
          هؤلاء هم موظفوك الذين يملكون صلاحية رفع طلبات التوصيل إلى النظام عبر روابط خاصة.
        </p>
        {shop.locationUrl ? (
          <a
            href={shop.locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-sm font-bold text-emerald-700 underline"
          >
            فتح موقع المحل على الخريطة ↗
          </a>
        ) : null}
      </div>

      <AddEmployeePanel shopId={shop.id} />

      <section className={ad.section}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className={ad.h2}>قائمة العملاء ({employees.length})</h2>
          <Link
            href={`/admin/shops/${shop.id}/edit`}
            className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
          >
            تعديل بيانات المحل
          </Link>
        </div>
        <EmployeesList
          shopId={shop.id}
          shopName={shop.name}
          locationUrl={shop.locationUrl}
          employees={employees}
        />
      </section>
    </div>
  );
}
