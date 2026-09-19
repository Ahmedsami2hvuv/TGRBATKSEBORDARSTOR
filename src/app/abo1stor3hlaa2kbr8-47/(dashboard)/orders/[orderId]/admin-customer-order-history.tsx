"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { DeliveryLoading } from "@/components/delivery-loading";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import { createReverseOrderFromExisting } from "./reverse-order-actions";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

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

/** مكون تفاعلي عند النقر على رقم الزبون يعرض نافذة عائمة تضم ملف الزبون وطلباته السابقة */
export function AdminCustomerPhoneInteractive({
  phone,
  formattedPhone,
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
  formattedPhone?: string;
  regionId?: string | null;
  currentOrderId: string;
  customerName?: string | null;
  customerRegionName?: string | null;
  alternatePhone?: string | null;
  customerLocationUrl?: string;
  customerLandmark?: string;
  customerProfileId?: string | null;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCreatingReverse, setIsCreatingReverse] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const router = useRouter();

  const displayPhone = formattedPhone || phone;

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleCreateReverseOrder = async () => {
    if (isCreatingReverse) return;
    setIsCreatingReverse(true);
    setReverseError(null);
    try {
      const res = await createReverseOrderFromExisting(currentOrderId);
      if (res.ok && res.newOrderId) {
        setShowMenu(false);
        router.push(`${SECRET_ADMIN_PATH}/orders/${res.newOrderId}`);
      } else {
        setReverseError(res.error || "تعذر إنشاء الطلب العكسي");
      }
    } catch (err: any) {
      setReverseError(err?.message || "حدث خطأ غير متوقع");
    } finally {
      setIsCreatingReverse(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setReverseError(null);
          setShowMenu(true);
        }}
        className="group inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50/80 hover:bg-sky-100/80 active:scale-95 px-2.5 py-1 text-sm font-black text-sky-950 transition-all cursor-pointer shadow-2xs"
        title="انقر لعرض ملف الزبون أو طلباته السابقة"
      >
        <span className="font-mono text-slate-900 font-extrabold">{displayPhone}</span>
        <span className="text-xs text-sky-600 group-hover:text-sky-800">⚡</span>
      </button>

      {/* --- نافذة الخيارات العائمة المنبثقة عند النقر على رقم الزبون --- */}
      {showMenu && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 animate-in zoom-in-95 duration-150 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>📱</span>
                  <span>خيارات الزبون</span>
                </h3>
                <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">{phone}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isCreatingReverse) setShowMenu(false);
                }}
                disabled={isCreatingReverse}
                className="h-8 w-8 rounded-full bg-slate-100 text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {reverseError && (
              <div className="mb-3 rounded-2xl bg-rose-50 border border-rose-200 p-2.5 text-center text-xs font-bold text-rose-700 shadow-2xs">
                ⚠️ {reverseError}
              </div>
            )}

            <div className="space-y-2.5">
              {/* خيار: ملف الزبون */}
              {customerProfileId ? (
                <Link
                  href={`${SECRET_ADMIN_PATH}/customers/profiles/${customerProfileId}/edit`}
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-sky-300 bg-sky-50/70 hover:bg-sky-100/90 p-3.5 text-sm font-black text-sky-950 shadow-xs transition-all active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-lg">📁</span>
                    <span>فتح ملف الزبون</span>
                  </span>
                  <span className="text-xs font-bold text-sky-700">تعديل الملف ⬅️</span>
                </Link>
              ) : (
                <Link
                  href={`${SECRET_ADMIN_PATH}/customers/info?phone=${encodeURIComponent(phone)}${regionId ? `&regionId=${encodeURIComponent(regionId)}` : ""}`}
                  onClick={() => setShowMenu(false)}
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-sky-300 bg-sky-50/70 hover:bg-sky-100/90 p-3.5 text-sm font-black text-sky-950 shadow-xs transition-all active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-lg">📁</span>
                    <span>ملف وبيانات الزبون</span>
                  </span>
                  <span className="text-xs font-bold text-sky-700">عرض ⬅️</span>
                </Link>
              )}

              {/* خيار: عرض طلبات الزبون السابقة */}
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowHistory(true);
                }}
                className="flex w-full items-center justify-between rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/90 p-3.5 text-sm font-black text-emerald-950 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-lg">📜</span>
                  <span>طلبات الزبون السابقة</span>
                </span>
                <span className="text-xs font-bold text-emerald-700">عرض السجل ⬅️</span>
              </button>

              {/* خيار: إنشاء طلب عكسي */}
              <button
                type="button"
                disabled={isCreatingReverse}
                onClick={handleCreateReverseOrder}
                className="flex w-full items-center justify-between rounded-2xl border-2 border-amber-300 bg-amber-50/80 hover:bg-amber-100/95 p-3.5 text-sm font-black text-amber-950 shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2.5">
                  <span className={`text-lg ${isCreatingReverse ? "animate-spin" : ""}`}>🔄</span>
                  <span>{isCreatingReverse ? "جاري إنشاء الطلب العكسي..." : "طلب عكسي"}</span>
                </span>
                <span className="text-xs font-bold text-amber-800">
                  {isCreatingReverse ? "⏳ يرجى الانتظار" : "إنشاء فوري ⬅️"}
                </span>
              </button>

              {/* أزرار سريعة: نسخ + اتصال + واتساب */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={copyPhone}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 p-2 text-xs font-black text-slate-800 transition-all cursor-pointer"
                >
                  <span>{copied ? "✅" : "📋"}</span>
                  <span>{copied ? "تم النسخ" : "نسخ الرقم"}</span>
                </button>
                <a
                  href={telHref(phone)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-700 p-2 text-xs font-black text-white transition-all shadow-xs"
                >
                  <span>📞</span>
                  <span>اتصال</span>
                </a>
                <a
                  href={whatsappMeUrl(phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 p-2 text-xs font-black text-white transition-all shadow-xs"
                >
                  <span>💬</span>
                  <span>واتس</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- النافذة العائمة الشاملة لطلبات الزبون السابقة --- */}
      {showHistory && (
        <AdminCustomerOrderHistoryModal
          phone={phone}
          regionId={regionId}
          currentOrderId={currentOrderId}
          customerName={customerName}
          customerRegionName={customerRegionName}
          alternatePhone={alternatePhone}
          customerLocationUrl={customerLocationUrl}
          customerLandmark={customerLandmark}
          customerProfileId={customerProfileId}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}

/** النافذة العائمة لعرض طلبات الزبون السابقة */
export function AdminCustomerOrderHistoryModal({
  phone,
  regionId,
  currentOrderId,
  customerName,
  customerRegionName,
  alternatePhone,
  customerLocationUrl,
  customerLandmark,
  customerProfileId,
  onClose,
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
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderHistoryItem[] | null>(null);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>(regionId ? regionKey(regionId) : "all");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("phone", phone);
    params.set("currentOrderId", currentOrderId);
    if (selectedRegionId !== "all") {
      params.set("regionId", selectedRegionId);
    }
    params.set("limit", "15");
    return params.toString();
  }, [phone, selectedRegionId, currentOrderId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOrders(null);

    fetch(`${SECRET_ADMIN_PATH}/api/customer-orders?${query}`, {
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
  }, [query]);

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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200" dir="rtl">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/80">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>📜</span>
              <span>بيانات وطلبات الزبون السابقة ({phone})</span>
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              آخر الطلبات المرتبطة برقم الزبون في {selectedRegionLabel}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4 space-y-4">
          {showRegionFilters && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedRegionId("all")}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  selectedRegionId === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                الكل
              </button>
              {regions.map((region) => (
                <button
                  key={region.key}
                  type="button"
                  onClick={() => setSelectedRegionId(region.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    selectedRegionId === region.key
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {region.name} ({region.count})
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="py-12">
              <DeliveryLoading message="جاري استرجاع طلبات الزبون السابقة..." />
            </div>
          )}

          {error && <p className="text-sm font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">خطأ: {error}</p>}

          {!loading && !error && orders !== null && (
            <div className="space-y-4">
              {/* بطاقة ملخص بيانات الزبون */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 shadow-xs">
                <h3 className="text-xs font-black text-slate-800 mb-2.5">بيانات الزبون المحفوظة</h3>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <p className="text-[10px] font-bold text-slate-500">الهاتف الرئيسي</p>
                    <p className="font-bold text-slate-900 font-mono">{phone}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <p className="text-[10px] font-bold text-slate-500">الهاتف الثاني</p>
                    <p className="font-bold text-slate-900 font-mono">{alternatePhone || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                    <p className="text-[10px] font-bold text-slate-500">المنطقة</p>
                    <p className="font-bold text-slate-900">{displayedRegionName}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 col-span-2 sm:col-span-2">
                    <p className="text-[10px] font-bold text-slate-500">العنوان / النقطة الدالة</p>
                    <p className="font-bold text-slate-900">{customerLandmark || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 col-span-2 sm:col-span-1">
                    <p className="text-[10px] font-bold text-slate-500">الموقع الجغرافي</p>
                    {customerLocationUrl ? (
                      <a href={customerLocationUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700 hover:underline">فتح اللوكيشن ↗</a>
                    ) : (
                      <p className="font-bold text-slate-400">—</p>
                    )}
                  </div>
                </div>
              </section>

              {/* قائمة الطلبات السابقة */}
              {orders.length === 0 ? (
                <p className="text-center text-sm font-bold text-slate-500 py-8 bg-slate-50 rounded-2xl border border-slate-200">
                  لا توجد طلبات سابقة مسجلة لهذا الزبون.
                </p>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-700">سجل الطلبات ({orders.length}):</h4>
                  {orders.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-sky-300 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-sky-600 text-white px-2 py-0.5 text-xs font-black font-mono">
                            #{item.orderNumber}
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            🏪 {item.shop.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 text-slate-800 px-2.5 py-0.5 text-xs font-black">
                            {item.status}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {new Date(item.createdAt).toLocaleDateString("ar-IQ-u-nu-latn")}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold text-slate-700">
                        <div>المنطقة: <span className="text-slate-900">{item.customerRegion?.name ?? "—"}</span></div>
                        <div>السعر: <span className="font-mono font-black text-slate-900">{item.totalAmount != null ? `${item.totalAmount} ألف` : "—"}</span></div>
                        <div>النوع: <span className="text-slate-900">{item.orderType || "—"}</span></div>
                      </div>

                      {item.customerLandmark && (
                        <p className="text-xs font-bold text-slate-600 mt-1.5">
                          🏛️ الدالة: {item.customerLandmark}
                        </p>
                      )}

                      {item.customerDoorPhotoUrl && (
                        <div className="mt-2">
                          <img src={resolvePublicAssetSrc(item.customerDoorPhotoUrl)} alt="صورة باب" className="h-24 w-full rounded-xl object-cover border border-slate-200" />
                        </div>
                      )}

                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                        {item.customerLocationUrl ? (
                          <a href={item.customerLocationUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-emerald-700 hover:underline">
                            📍 فتح موقع الطلب ↗
                          </a>
                        ) : <span />}
                        <Link
                          href={`${SECRET_ADMIN_PATH}/orders/${item.id}`}
                          target="_blank"
                          className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 text-xs font-bold transition-colors"
                        >
                          عرض تفاصيل الطلب ↗
                        </Link>
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
  );
}

