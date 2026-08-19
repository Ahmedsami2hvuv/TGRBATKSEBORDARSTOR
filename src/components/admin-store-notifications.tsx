"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rejectPreparerDraft, assignOrderToPreparer, type RejectOrderState, type AssignOrderState } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/orders/actions";

type StoreOrder = {
  id: string;
  orderNumber: number;
  title: string;
  customerPhone: string;
  regionName: string;
  landmark: string;
  productsCount: number;
  createdAt: string;
};

type Preparer = {
  id: string;
  name: string;
};

export function AdminStoreNotifications() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [preparers, setPreparers] = useState<Preparer[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const router = useRouter();
  
  // لجلب البيانات بشكل دوري
  useEffect(() => {
    let cancelled = false;
    const fetchStoreOrders = async () => {
      try {
        const res = await fetch("/api/notifications/admin-store-pending", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setOrders(data.pendingStoreOrders || []);
          setPreparers(data.preparers || []);
        }
      } catch (e) {
        console.error("Failed to fetch store orders", e);
      }
    };

    fetchStoreOrders();
    const intervalId = setInterval(fetchStoreOrders, 10000); // تحديث كل 10 ثواني
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleReject = async (id: string) => {
    if (processingId) return;
    if (!confirm("هل أنت متأكد من رفض الطلب؟")) return;
    
    setProcessingId(id);
    try {
      const fd = new FormData();
      fd.append("draftId", id);
      const res = await rejectPreparerDraft({} as RejectOrderState, fd);
      if (res.ok) {
        handleDismiss(id);
      } else {
        alert(res.error || "حدث خطأ أثناء الرفض");
      }
    } catch (e) {
      alert("حدث خطأ");
    }
    setProcessingId(null);
  };

  const handleAssign = async (id: string, preparerId: string) => {
    if (!preparerId || processingId) return;
    
    setProcessingId(id);
    try {
      const fd = new FormData();
      fd.append("orderId", id);
      fd.append("preparerIdsJson", JSON.stringify([preparerId]));
      fd.append("isDraft", "true");
      
      const res = await assignOrderToPreparer({} as AssignOrderState, fd);
      if (res.ok) {
        handleDismiss(id);
      } else {
        alert(res.error || "حدث خطأ أثناء الإسناد");
      }
    } catch (e) {
      alert("حدث خطأ");
    }
    setProcessingId(null);
  };

  // نحصل على الطلبات التي لم يتم تجاهلها
  const visibleOrders = orders.filter(o => !dismissedIds.has(o.id));

  if (visibleOrders.length === 0) return null;

  const content = (
    <div className="fixed bottom-4 end-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full p-4" dir="rtl">
      {visibleOrders.map(order => (
        <div key={order.id} className="bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-xl shadow-[0_4px_20px_rgba(14,165,233,0.3)] p-4 pointer-events-auto flex flex-col gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-black">
              <span className="text-xl">🛒</span>
              <span>{order.title || "طلب من المتجر الالكتروني"}</span>
            </div>
            <button 
              onClick={() => handleDismiss(order.id)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300">
            <p className="flex justify-between items-center py-1">
              <span className="text-slate-500">العنوان:</span>
              <span>{order.regionName} {order.landmark ? `- ${order.landmark}` : ""}</span>
            </p>
            <p className="flex justify-between items-center py-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500">عدد المنتجات:</span>
              <span className="bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 px-2 py-0.5 rounded-full">{order.productsCount}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <select
              disabled={processingId === order.id}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-sm font-bold focus:outline-none focus:border-sky-500"
              onChange={(e) => {
                if(e.target.value) handleAssign(order.id, e.target.value);
                e.target.value = ""; // إرجاع السيلكت للحالة الافتراضية بعد الاختيار
              }}
            >
              <option value="">إسناد الطلب لمجهز...</option>
              {preparers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className="flex gap-2 w-full mt-1">
              <Link 
                href={`/abo1stor3hlaa2kbr8-47/orders/pending?tab=preparing`}
                onClick={() => handleDismiss(order.id)}
                className="flex-1 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-900/50 text-center text-sm font-bold py-2 rounded-lg transition-colors"
              >
                فتح التفاصيل
              </Link>
              <button 
                disabled={processingId === order.id}
                onClick={() => handleReject(order.id)}
                className="flex-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/50 text-center text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {processingId === order.id ? "جاري الرفض..." : "رفض الطلب"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  
  return null;
}
