"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function CustomerSourceFilter({
  source,
  blockedCount,
  q,
}: {
  source: string;
  blockedCount: number;
  q: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    if (val && val !== "all") {
      params.set("source", val);
    } else {
      params.delete("source");
    }
    params.set("page", "1"); // العودة للصفحة الأولى عند تغيير الفلترة
    router.replace(`/abo1stor3hlaa2kbr8-47/customers?${params.toString()}`);
  };

  return (
    <select
      name="source"
      value={source}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-400 outline-none cursor-pointer flex-1 sm:flex-initial text-right select-none"
      dir="rtl"
    >
      <option value="all">كل المصادر</option>
      <option value="blocked">🔴 المحظورين ({blockedCount})</option>
      <option value="railway">قادمين من ريلوي</option>
      <option value="orders">قادمين من طلبات الموقع</option>
      <option value="reference">مضافين مرجعياً</option>
    </select>
  );
}
