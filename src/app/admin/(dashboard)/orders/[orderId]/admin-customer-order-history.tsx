"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { DeliveryLoading } from "@/components/delivery-loading";

type RegionOption = {
  id: string | null;
  key: string;
  name: string;
  count: number;
};

type OrderHistoryItem = {
  id: string;
  orderNumber: number;
  status: string;
  createdAt: string;
  orderType: string | null;
  orderSubtotal: number | null;
  deliveryPrice: number | null;
  totalAmount: number | null;
  shop: { name: string };
  customerRegion: { name: string } | null;
  customerLandmark: string | null;
  alternatePhone: string | null;
  customerDoorPhotoUrl: string | null;
  customerLocationUrl: string | null;
};

const regionKey = (id: string | null) => id ?? "__none";

export function AdminCustomerOrderHistory({
  phone,
  regionId,
  currentOrderId,
  customerName,
  customerRegionName,
  alternatePhone,
  customerLocationUrl,
  customerLandmark,
  customerProfileId,
}: {
  phone: string;
  regionId?: string | null;
  currentOrderId: string;
  customerName?: string | null;
  customerRegionName?: string | null;
  alternatePhone?: string | null;
  customerLocationUrl?: string;
  customerLandmark?: string;
  customerProfileId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderHistoryItem[] | null>(null);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(regionId ? regionKey(regionId) : "all");

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedRegionId(regionId ? regionKey(regionId) : "all");
  }, [open, regionId]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("phone", phone);
    params.set("currentOrderId", currentOrderId);
    if (selectedRegionId !== "all") {
      params.set("regionId", selectedRegionId);
    }
    params.set("limit", "10");
    return params.toString();
  }, [phone, selectedRegionId, currentOrderId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoading(true);
    setError(null);
    setOrders(null);

    fetch(`/admin/api/customer-orders?${query}`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setRegions(Array.isArray(data.regions) ? data.regions : []);
      })
      .catch((err) => {
        setError(String(err.message || err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, query]);

  const selectedRegionLabel =
    selectedRegionId === "all"
      ? "كل المناطق"
      : regions.find((region) => region.key === selectedRegionId)?.name ||
        customerRegionName ||
        "غير محددة";

  const displayedRegionName =
    selectedRegionId === "all"
      ? customerRegionName || (regionId ? regionId : "غير محددة")
      : selectedRegionLabel;

  const showRegionFilters = regions.length > 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-50 transition-colors"
      >
        عرض بيانات الزبون وطلباته السابقة
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">بيانات الزبون وطلباته السابقة</h2>
                <p className="text-sm text-slate-500">
                  آخر 10 طلبات مرتبطة بهاتف الزبون في {selectedRegionLabel}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
              {showRegionFilters && (
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRegionId("all")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedRegionId === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
                  >
                    الكل
                  </button>
                  {regions.map((region) => (
                    <button
                      key={region.key}
                      type="button"
                      onClick={() => setSelectedRegionId(region.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedRegionId === region.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
                    >
                      {region.name} ({region.count})
                    </button>
                  ))}
                </div>
              )}
              {loading && (
                <div className="py-8">
                  <DeliveryLoading message="جاري استرجاع طلبات الزبون..." />
                </div>
              )}
              {error && <p className="text-sm font-semibold text-rose-600">خطأ: {error}</p>}
              {!loading && !error && orders !== null && (
                <div className="space-y-4">
                  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900">معلومات الزبون</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {customerName ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase text-slate-500">الاسم</p>
                          <p className="text-sm font-bold text-slate-900">{customerName}</p>
                        </div>
                      ) : null}
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs uppercase text-slate-500">الهاتف الرئيسي</p>
                        <p className="text-sm font-bold text-slate-900 font-mono tabular-nums">{phone}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs uppercase text-slate-500">الهاتف الثاني</p>
                        <p className="text-sm font-bold text-slate-900 font-mono tabular-nums">{alternatePhone || "—"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs uppercase text-slate-500">المنطقة</p>
                        <p className="text-sm font-bold text-slate-900">{displayedRegionName}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs uppercase text-slate-500">العنوان/العلامة</p>
                        <p className="text-sm font-bold text-slate-900">{customerLandmark || "—"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs uppercase text-slate-500">رابط اللوكيشن</p>
                        {customerLocationUrl ? (
                          <a href={customerLocationUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emerald-700 hover:underline">فتح اللوكيشن</a>
                        ) : (
                          <p className="text-sm font-bold text-slate-900">—</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {customerProfileId ? (
                        <Link href={`/admin/customers/profiles/${customerProfileId}/edit`} className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 transition-colors">
                          فتح ملف الزبون
                        </Link>
                      ) : (
                        <Link href={`/admin/customers/info?phone=${encodeURIComponent(phone)}${regionId ? `&regionId=${encodeURIComponent(regionId)}` : ""}`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-50 transition-colors">
                          عرض صفحة بيانات الزبون
                        </Link>
                      )}
                    </div>
                  </section>
                  {orders.length === 0 ? (
                    <p className="text-sm text-slate-600">لا توجد طلبات سابقة لهذا الزبون.</p>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-700">طلب #{item.orderNumber}</p>
                              <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("ar-IQ-u-nu-latn", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{item.status}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{item.shop.name}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{item.customerRegion?.name ?? "—"}</span>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-white p-3 shadow-sm">
                              <p className="text-xs uppercase text-slate-500">نوع الطلب</p>
                              <p className="text-sm font-bold text-slate-900">{item.orderType || "—"}</p>
                            </div>
                            <div className="rounded-xl bg-white p-3 shadow-sm">
                              <p className="text-xs uppercase text-slate-500">المبلغ الكلي</p>
                              <p className="text-sm font-bold text-slate-900">{item.totalAmount != null ? `${item.totalAmount} ` : "—"}</p>
                            </div>
                            <div className="rounded-xl bg-white p-3 shadow-sm">
                              <p className="text-xs uppercase text-slate-500">التوصيل</p>
                              <p className="text-sm font-bold text-slate-900">{item.deliveryPrice != null ? `${item.deliveryPrice} ` : "—"}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl bg-white p-3 shadow-sm">
                              <p className="text-xs uppercase text-slate-500">الهاتف الثاني</p>
                              <p className="text-sm font-bold text-slate-900 font-mono tabular-nums">{item.alternatePhone || "—"}</p>
                            </div>
                            <div className="rounded-xl bg-white p-3 shadow-sm">
                              <p className="text-xs uppercase text-slate-500">أقرب نقطة</p>
                              <p className="text-sm font-bold text-slate-900">{item.customerLandmark || "—"}</p>
                            </div>
                          </div>
                          {item.customerLocationUrl ? (
                            <div className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                              <p className="text-xs uppercase text-slate-500">رابط اللوكيشن</p>
                              <a href={item.customerLocationUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emerald-700 hover:underline">فتح اللوكيشن</a>
                            </div>
                          ) : null}
                          {item.customerDoorPhotoUrl ? (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                              <p className="text-xs uppercase text-slate-500">صورة باب الزبون</p>
                              <img src={resolvePublicAssetSrc(item.customerDoorPhotoUrl)} alt="صورة باب الزبون" className="mt-2 max-h-44 w-full rounded-xl object-cover" />
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link href={`/admin/orders/${item.id}`} className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors">عرض الطلب</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
