"use client";
// v4-bulletproof-fix: ضمان الحفظ الفوري ومنع التضارب + الخروج التلقائي عند النجاح + دعم الملكية للمجهز

import { useActionState, useMemo, useRef, useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { submitPreparerShoppingDraft, updatePreparerShoppingDraft, type PreparerActionState } from "@/app/preparer/actions";
import { suggestFixedPrices } from "@/lib/fixed-prices";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { calculateAutoSellPrice, isMeatProduct } from "@/lib/auto-pricing";
import { preparerPath } from "@/lib/preparer-portal-nav";

const initial: PreparerActionState = {};
const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

type ProductRow = {
  line: string;
  buyAlf: number | "";
  sellAlf: number | "";
  pricedBy?: string | null;
  pricedById?: string | null;
  assignedPreparerId?: string | null;
  assignedPreparerName?: string | null;
};

type DraftWithRegion = {
  id: string;
  titleLine: string;
  customerPhone: string;
  customerName: string;
  customerLandmark: string;
  orderTime: string;
  placesCount: number | null;
  data: unknown;
  customerRegion: { id: string; name: string } | null;
};

function parseProducts(raw: unknown): ProductRow[] {
  if (!raw || typeof raw !== "object" || raw === null) return[];
  const o = raw as Record<string, any>;
  const productsRaw = o.products;
  if (!Array.isArray(productsRaw)) return [];

  const results: ProductRow[] =[];
  for (const x of productsRaw) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, any>;
    const line = String(r.line ?? "").trim();
    if (!line) continue;

    const bRaw = r.buyAlf;
    const sRaw = r.sellAlf;

    const bNum = (bRaw === null || bRaw === undefined || bRaw === "") ? "" : Number(bRaw);
    const sNum = (sRaw === null || sRaw === undefined || sRaw === "") ? "" : Number(sRaw);

    results.push({
      line,
      buyAlf: (typeof bNum === "number" && Number.isFinite(bNum)) ? bNum : "",
      sellAlf: (typeof sNum === "number" && Number.isFinite(sNum)) ? sNum : "",
      pricedBy: typeof r.pricedBy === "string" ? r.pricedBy : (typeof r.pricedByName === "string" ? r.pricedByName : null),
      pricedById: typeof r.pricedById === "string" ? r.pricedById : null,
      assignedPreparerId: typeof r.assignedPreparerId === "string" ? r.assignedPreparerId : null,
      assignedPreparerName: typeof r.assignedPreparerName === "string" ? r.assignedPreparerName : null,
    });
  }
  return results;
}

function isLikelyPhoneText(text: string) {
  const cleaned = String(text || "").replace(/\D/g, "");
  return cleaned.length >= 7 && cleaned.length <= 13 && /^[+\d\s()\-]+$/.test(String(text));
}

export function PreparerShoppingDraftEditClient({
  auth,
  draft: initialDraft,
  draftOwnerId,
  preparerId,
  preparerName,
  productImagesMap,
  productBranchMap,
}: {
  auth: { p: string; exp: string; s: string };
  draft: DraftWithRegion;
  draftOwnerId: string;
  preparerId: string;
  preparerName: string;
  productImagesMap: Record<string, string>;
  productBranchMap: Record<string, string>;
}) {
  const router = useRouter();
  const[saveState, saveAction, savePending] = useActionState(updatePreparerShoppingDraft, initial);
  const[submitState, submitAction, submitPending] = useActionState(submitPreparerShoppingDraft, initial);
  const[isAutoSaving, startAutoSave] = useTransition();

  const[titleLine, setTitleLine] = useState(initialDraft.titleLine || "");
  const [customerPhone, setCustomerPhone] = useState(initialDraft.customerPhone || "");
  const[customerName, setCustomerName] = useState(initialDraft.customerName || "");
  const [customerLandmark, setCustomerLandmark] = useState(initialDraft.customerLandmark || "");
  const[orderTime, setOrderTime] = useState(initialDraft.orderTime || "فوري");
  const fallbackTitle = titleLine.trim();
  const customerDisplayName = (customerName || "").trim() || initialDraft.customerRegion?.name || (!isLikelyPhoneText(fallbackTitle) ? fallbackTitle : "") || "—";
  const[showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [placesCount, setPlacesCount] = useState<number | "">(initialDraft.placesCount ?? "");
  const [products, setProducts] = useState<ProductRow[]>(() => parseProducts(initialDraft.data));
  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const [tempBasePrice, setTempBasePrice] = useState<number | null>(null);

  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  // --- Floating Bubble Logic ---
  const [bubblePos, setBubblePos] = useState({ x: 20, y: 150 });
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });
  const [bubbleMode, setBubbleMode] = useState<"floating" | "fixed">("floating");
  const [bubbleSize, setBubbleSize] = useState(1); // 1 = normal, can go 0.5 to 2
  const [showBubbleSettings, setShowBubbleSettings] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // --- Persistence Logic ---
  useEffect(() => {
    const savedMode = localStorage.getItem("kse_bubbleMode") as any;
    const savedSize = localStorage.getItem("kse_bubbleSize");
    const savedPos = localStorage.getItem("kse_bubblePos");
    if (savedMode) setBubbleMode(savedMode);
    if (savedSize) setBubbleSize(parseFloat(savedSize));
    if (savedPos) setBubblePos(JSON.parse(savedPos));
  }, []);

  useEffect(() => {
    localStorage.setItem("kse_bubbleMode", bubbleMode);
    localStorage.setItem("kse_bubbleSize", bubbleSize.toString());
    localStorage.setItem("kse_bubblePos", JSON.stringify(bubblePos));
  }, [bubbleMode, bubbleSize, bubblePos]);
  // -------------------------

  const myTotalBuyAlf = useMemo(() => {
    return products.reduce((sum, p) => {
      if (typeof p.buyAlf === "number" && p.pricedById === preparerId) {
        return sum + p.buyAlf;
      }
      return sum;
    }, 0);
  }, [products, preparerId]);

  const onBubbleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (showBubbleSettings) return;

    // منع القوائم الجانبية ومنع السحب الافتراضي للمتصفح
    if (e.cancelable) {
        // نمنع الافتراضي فقط في التاتش لضمان عمل العداد
        if ('touches' in e) e.preventDefault();
    }

    const pos = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);

    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    // Long press logic
    longPressTimer.current = setTimeout(() => {
      setShowBubbleSettings(true);
      setDragging(false);
    }, 800);

    setDragging(true);

    if (bubbleMode === "floating") {
      setRel({
        x: pos.clientX - bubblePos.x,
        y: pos.clientY - bubblePos.y
      });
    }
  }, [bubblePos, showBubbleSettings, bubbleMode]);

  const onBubbleMouseUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setDragging(false);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: any) => {
      if (!dragging || showBubbleSettings || bubbleMode !== "floating") return;
      const pos = e.touches ? e.touches[0] : e;
      setBubblePos({
        x: Math.max(0, Math.min(window.innerWidth - 80, pos.clientX - rel.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, pos.clientY - rel.y))
      });
    };

    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onBubbleMouseUp);
      window.addEventListener('touchmove', onMouseMove, { passive: false });
      window.addEventListener('touchend', onBubbleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onBubbleMouseUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onBubbleMouseUp);
    };
  }, [dragging, rel, showBubbleSettings, onBubbleMouseUp]);

  // --- Price History ---
  const [priceHistory, setPriceHistory] = useState<Record<string, { buyAlf: number }[]>>({});
  const fetchPriceHistory = useCallback(async (productName: string) => {
    if (priceHistory[productName]) return;
    try {
      const res = await fetch(`/api/preparer/product-history?name=${encodeURIComponent(productName)}&p=${auth.p}&exp=${auth.exp}&s=${auth.s}`);
      if (res.ok) {
        const data = await res.json();
        setPriceHistory(prev => ({ ...prev, [productName]: data }));
      }
    } catch (e) {
      console.error("History fail", e);
    }
  }, [auth, priceHistory]);

  useEffect(() => {
    if (selectedPriceIndex !== null) {
      const p = products[selectedPriceIndex];
      if (p) fetchPriceHistory(p.line);
    }
  }, [selectedPriceIndex, products, fetchPriceHistory]);
  // -----------------------------
  const[pricingLinesText, setPricingLinesText] = useState("");
  const [pricingErr, setPricingErr] = useState<string | null>(null);
  const pricingTextareaRef = useRef<HTMLTextAreaElement>(null);

  const[deleteMode, setDeleteMode] = useState(false);
  const [showAddProductsPanel, setShowAddProductsPanel] = useState(false);
  const [addProductsText, setAddProductsText] = useState("");
  const isDirtyRef = useRef(false);
  const lastSavedJsonRef = useRef(JSON.stringify(products));

  // التحويل التلقائي عند نجاح الإرسال
  useEffect(() => {
    if (submitState.ok) {
        const t = setTimeout(() => {
            router.push(preparerPath("/preparer", auth));
        }, 1500);
        return () => clearTimeout(t);
    }
  }, [submitState.ok, router, auth]);

  const allProductsPriced = products.length > 0 && products.every((p) => p.buyAlf !== "" && p.sellAlf !== "");

  const productsJson = useMemo(
    () =>
      JSON.stringify(
        products.map((p) => ({
          line: p.line,
          buyAlf: p.buyAlf === "" ? null : p.buyAlf,
          sellAlf: p.sellAlf === "" ? null : p.sellAlf,
          pricedBy: p.pricedBy,
          pricedById: p.pricedById,
          assignedPreparerId: p.assignedPreparerId,
          assignedPreparerName: p.assignedPreparerName,
        })),
      ),
    [products],
  );

  const performSave = useCallback(async (jsonToSave: string) => {
    isDirtyRef.current = true;
    startAutoSave(() => {
        const fd = new FormData();
        fd.append("p", auth.p);
        fd.append("exp", auth.exp);
        fd.append("s", auth.s);
        fd.append("draftId", initialDraft.id);
        fd.append("titleLine", titleLine);
        fd.append("customerPhone", customerPhone);
        fd.append("customerName", customerName);
        fd.append("customerLandmark", customerLandmark);
        fd.append("orderTime", orderTime);
        fd.append("placesCount", placesCount === "" ? "" : String(placesCount));
        fd.append("productsJson", jsonToSave);

        updatePreparerShoppingDraft(initial, fd).then(res => {
            if (res.ok) {
                isDirtyRef.current = false;
                lastSavedJsonRef.current = jsonToSave;
            }
        }).catch(console.error);
    });
  },[auth, initialDraft.id, titleLine, customerPhone, customerName, customerLandmark, orderTime, placesCount]);


  function addProductsFromText() {
    const lines = addProductsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const next: ProductRow[] =[
        ...products,
        ...lines.map((line) => ({ line, buyAlf: "" as const, sellAlf: "" as const, pricedBy: null, pricedById: null, assignedPreparerId: null, assignedPreparerName: null })),
    ];
    setProducts(next);
    const nextJson = JSON.stringify(next.map(p => ({
        line: p.line,
        buyAlf: p.buyAlf === "" ? null : p.buyAlf,
        sellAlf: p.sellAlf === "" ? null : p.sellAlf,
        pricedBy: p.pricedBy,
        pricedById: p.pricedById,
        assignedPreparerId: p.assignedPreparerId,
        assignedPreparerName: p.assignedPreparerName,
    })));
    performSave(nextJson);
    setAddProductsText("");
    setShowAddProductsPanel(false);
  }

  function removeProductByIndex(idx: number) {
    const next = products.filter((_, i) => i !== idx);
    setProducts(next);
    const nextJson = JSON.stringify(next.map(p => ({
        line: p.line,
        buyAlf: p.buyAlf === "" ? null : p.buyAlf,
        sellAlf: p.sellAlf === "" ? null : p.sellAlf,
        pricedBy: p.pricedBy,
        pricedById: p.pricedById,
        assignedPreparerId: p.assignedPreparerId,
        assignedPreparerName: p.assignedPreparerName,
    })));
    performSave(nextJson);
  }

  const fetchLatestData = useCallback(async () => {
    if (selectedPriceIndex !== null || showAddProductsPanel || deleteMode || isDirtyRef.current || isAutoSaving) {
        return;
    }
    try {
      const res = await fetch(`/api/preparer/draft?id=${initialDraft.id}&p=${auth.p}&exp=${auth.exp}&s=${auth.s}`);
      if (res.ok) {
        const latest = await res.json();

        // إخراج المستخدم فوراً إذا قام المجهز الآخر بإرسال الطلب للنظام!
        if (latest.status === "sent" || latest.status === "archived") {
            router.push(preparerPath("/preparer", auth));
            return;
        }

        const latestJson = JSON.stringify(parseProducts(latest.data));
        if (latestJson !== lastSavedJsonRef.current) {
            setProducts(parseProducts(latest.data));
            setPlacesCount(latest.placesCount ?? "");
            lastSavedJsonRef.current = latestJson;
        }
      }
    } catch (e) {
      console.error("Polling failed", e);
    }
  },[initialDraft.id, auth, selectedPriceIndex, showAddProductsPanel, deleteMode, isAutoSaving, router]);

  useEffect(() => {
    // Background polling disabled to improve performance
    // const timer = setInterval(fetchLatestData, 5000);
    // return () => clearInterval(timer);
    return () => {};
  }, [fetchLatestData]);

  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const t = setTimeout(() => {
        if (isDirtyRef.current) {
            performSave(productsJson);
        }
    }, 2000);
    return () => clearTimeout(t);
  },[titleLine, customerPhone, customerName, customerLandmark, orderTime, placesCount, performSave, productsJson]);

  function applyPricingPanel() {
    setPricingErr(null);
    if (selectedPriceIndex == null) return;
    const lines = pricingLinesText.split(/\r?\n/).map((x) => x.replace(/,/g, ".").trim()).filter(Boolean);
    if (lines.length === 0) {
      setPricingErr("اكتب سعر الشراء .");
      return;
    }
    const buy = parseFloat(lines[0]!);
    if (!Number.isFinite(buy) || buy < 0) {
      setPricingErr("تأكد أن السعر رقم صحيح.");
      return;
    }
    let sell = lines[1] ? parseFloat(lines[1]) : calculateAutoSellPrice(products[selectedPriceIndex]!.line, buy);

    const nextProducts =[...products];
    const target = nextProducts[selectedPriceIndex];
    if (target) {
        nextProducts[selectedPriceIndex] = { ...target, buyAlf: buy, sellAlf: sell, pricedBy: preparerName, pricedById: preparerId };
        const nextJson = JSON.stringify(nextProducts.map(p => ({
            line: p.line,
            buyAlf: p.buyAlf === "" ? null : p.buyAlf,
            sellAlf: p.sellAlf === "" ? null : p.sellAlf,
            pricedBy: p.pricedBy,
            pricedById: p.pricedById,
            assignedPreparerId: p.assignedPreparerId,
            assignedPreparerName: p.assignedPreparerName,
        })));
        setProducts(nextProducts);
        performSave(nextJson);
    }
    setSelectedPriceIndex(null);
    setPricingLinesText("");
  }

  function unpriceProduct() {
    if (selectedPriceIndex === null) return;
    const nextProducts = [...products];
    const target = nextProducts[selectedPriceIndex];
    if (target) {
      nextProducts[selectedPriceIndex] = { ...target, buyAlf: "", sellAlf: "", pricedBy: null, pricedById: null };
      const nextJson = JSON.stringify(nextProducts.map(p => ({
        line: p.line,
        buyAlf: p.buyAlf === "" ? null : p.buyAlf,
        sellAlf: p.sellAlf === "" ? null : p.sellAlf,
        pricedBy: p.pricedBy,
        pricedById: p.pricedById,
        assignedPreparerId: p.assignedPreparerId,
        assignedPreparerName: p.assignedPreparerName,
      })));
      setProducts(nextProducts);
      performSave(nextJson);
    }
    setSelectedPriceIndex(null);
    setPricingLinesText("");
    setTempBasePrice(null);
  }

  function handleAutoPriceMeat(idx: number) {
    const p = products[idx];
    if (!p) return;
    const fixed = suggestFixedPrices(p.line);
    if (fixed) {
        const nextProducts = [...products];
        nextProducts[idx] = { ...p, buyAlf: fixed.buyAlf, sellAlf: fixed.sellAlf, pricedBy: "تسعير تلقائي (لحم)", pricedById: "auto" };
        setProducts(nextProducts);
        const nextJson = JSON.stringify(nextProducts.map(pp => ({
            line: pp.line,
            buyAlf: pp.buyAlf === "" ? null : pp.buyAlf,
            sellAlf: pp.sellAlf === "" ? null : pp.sellAlf,
            pricedBy: pp.pricedBy,
            pricedById: pp.pricedById,
            assignedPreparerId: pp.assignedPreparerId,
            assignedPreparerName: pp.assignedPreparerName,
        })));
        performSave(nextJson);
    }
  }

  const orderedForButtons = useMemo(() => {
    const withIndex = products.map((p, idx) => ({
      p,
      idx,
      branch: productBranchMap[p.line.trim().toLowerCase()] || "أخرى"
    }));

    return withIndex.sort((a, b) => {
      const aPriced = a.p.buyAlf !== "" && a.p.sellAlf !== "";
      const bPriced = b.p.buyAlf !== "" && b.p.sellAlf !== "";

      // 1. المواد غير المسعرة تظهر أولاً
      if (aPriced !== bPriced) {
        return aPriced ? 1 : -1;
      }

      // 2. الترتيب حسب اسم الفرع/المحل
      if (a.branch !== b.branch) {
        return a.branch.localeCompare(b.branch, 'ar');
      }

      // 3. الترتيب الأصلي
      return a.idx - b.idx;
    });
  }, [products, productBranchMap]);

  const canSubmit = products.length > 0 && allProductsPriced && typeof placesCount === "number";

  if (submitState.ok) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4" dir="rtl">
            <div className="size-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <svg className="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900">تم إرسال الطلب بنجاح!</h2>
            <p className="text-slate-500 font-bold">جاري العودة للرئيسية...</p>
        </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <section className="kse-glass-dark flex items-center justify-between rounded-2xl border border-violet-200 p-4 shadow-sm">
        <h1 className="text-base font-black text-violet-950">تجهيز مشترك: {initialDraft.customerRegion?.name}</h1>
        <div className="flex flex-col items-end">
            {isAutoSaving || isDirtyRef.current ? (
                <p className="text-[10px] text-amber-600 font-bold animate-pulse">⏳ جاري الحفظ...</p>
            ) : (
                <p className="text-[10px] text-emerald-600 font-bold">✅ تم حفظ التغييرات</p>
            )}
        </div>
      </section>

        <button type="button" onClick={() => setShowCustomerInfo((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-black text-sky-950">
          <span>المنطقة: {customerDisplayName}</span>
          <span>{showCustomerInfo ? "−" : "+"}</span>
        </button>
        {showCustomerInfo && (
          <div className="mt-3 space-y-3">
            <input value={titleLine} onChange={(e) => { setTitleLine(e.target.value); isDirtyRef.current = true; }} className={inputClass} placeholder="العنوان" />
            <input value={orderTime} onChange={(e) => { setOrderTime(e.target.value); isDirtyRef.current = true; }} className={inputClass} placeholder="الوقت" />
          </div>
        )}

      <section className="kse-glass-dark rounded-2xl border border-indigo-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-indigo-950">قائمة المنتجات</h2>
            <div className="flex gap-1">
                {bubbleMode === "fixed" && (
                  <div
                    onMouseDown={onBubbleMouseDown}
                    onTouchStart={onBubbleMouseDown}
                    onMouseUp={onBubbleMouseUp}
                    onTouchEnd={onBubbleMouseUp}
                    onContextMenu={(e) => e.preventDefault()}
                    className="flex items-center justify-center bg-violet-600 text-white px-3 py-1 rounded-lg text-sm font-black shadow-sm cursor-pointer select-none active:scale-90 transition-transform touch-none"
                  >
                    {myTotalBuyAlf.toLocaleString()}
                  </div>
                )}
                <button type="button" onClick={() => { setShowAddProductsPanel(!showAddProductsPanel); setDeleteMode(false); }} className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-[10px] font-bold">+ مادة</button>
                <button type="button" onClick={() => { setDeleteMode(!deleteMode); setShowAddProductsPanel(false); }} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${deleteMode ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>حذف</button>
            </div>
        </div>


        {showAddProductsPanel && (
            <div className="mb-3 p-3 bg-white rounded-xl border-2 border-emerald-200 shadow-inner">
                <textarea value={addProductsText} onChange={(e) => setAddProductsText(e.target.value)} rows={3} className={inputClass} placeholder="اكتب المواد الجديدة هنا..." />
                <button type="button" onClick={addProductsFromText} className="mt-2 w-full bg-emerald-600 text-white rounded-lg py-2 text-xs font-black">إضافة للمجموعة</button>
            </div>
        )}

        <div className="flex flex-col gap-2">
          {orderedForButtons.map(({ p, idx: i }) => {
            const isMeat = isMeatProduct(p.line);
            const priced = p.buyAlf !== "" && p.sellAlf !== "";
            const isAssignedToOther = Boolean(p.assignedPreparerId && p.assignedPreparerId !== preparerId);
            const isPricedByOther = Boolean(priced && p.pricedById && p.pricedById !== preparerId && p.pricedById !== "auto");
            const isOthers = isAssignedToOther || isPricedByOther;
            const active = i === selectedPriceIndex;

            return (
              <button
                key={`${i}-${p.line}`}
                type="button"
                disabled={(isAssignedToOther || isPricedByOther) && !deleteMode}
                onClick={() => {
                  if (deleteMode) { removeProductByIndex(i); return; }
                  if (isMeat) {
                      if (!priced) handleAutoPriceMeat(i);
                      return;
                  }
                  if (isAssignedToOther || isPricedByOther) return;
                  setSelectedPriceIndex(i);
                  setTempBasePrice(null);
                  setPricingLinesText(priced ? `${p.buyAlf}` : "");
                  setTimeout(() => pricingTextareaRef.current?.focus(), 50);
                }}
                className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-start transition ${
                  active ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" :
                  isOthers ? "border-slate-300 bg-slate-100 opacity-40 grayscale cursor-not-allowed" :
                  priced ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-200 bg-white shadow-sm"
                } ${isMeat && priced ? "opacity-90 cursor-default" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">

                  {/* صورة المنتج */}
                  {productImagesMap[p.line.trim().toLowerCase()] && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomImage({
                          url: productImagesMap[p.line.trim().toLowerCase()]!,
                          title: p.line
                        });
                      }}
                      className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 active:scale-95 transition-transform"
                    >
                      <img
                        src={productImagesMap[p.line.trim().toLowerCase()]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}

                  <div className="min-w-0 flex-1">
                      <p className={`text-xs font-black ${priced && !isOthers ? "text-white" : "text-slate-800"}`}>{p.line}</p>

                      {/* اسم الفرع/المحل */}
                      {productBranchMap[p.line.trim().toLowerCase()] && (
                        <p className={`text-[9px] font-black px-1.5 py-0.5 rounded-md inline-block mb-1 ${priced && !isOthers ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                          📍 {productBranchMap[p.line.trim().toLowerCase()]}
                        </p>
                      )}

                    {isAssignedToOther ? (
                      <p className="text-[10px] font-bold text-slate-500">مسند لمجهز آخر</p>
                    ) : p.assignedPreparerId === preparerId ? (
                      <p className="text-[10px] font-bold text-emerald-300">مسند لك</p>
                    ) : priced ? (
                      <p className={`text-[10px] font-bold ${isOthers ? "text-slate-500" : "text-emerald-300"}`}>{isPricedByOther ? "بواسطة مجهز آخر" : (p.pricedById === "auto" ? "تسعير تلقائي" : "أنت")}</p>
                    ) : null}
                  </div>
                </div>
                {isMeat ? (
                    priced ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded">✅ تلقائي</span>
                    ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">📝 اضغط للتسعير التلقائي</span>
                    )
                ) : priced ? (
                    <span className={`font-mono text-xs font-black ${isOthers ? "text-slate-500" : "text-emerald-400"}`}>{p.buyAlf}  (شراء)</span>
                ) : (
                    <span className="text-[10px] text-slate-400">📝 اضغط للتسعير</span>
                )}
              </button>
            );
          })}
        </div>

        {selectedPriceIndex !== null && (
            <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                <p className="text-xs font-black text-slate-500 mb-2">تسعير: {products[selectedPriceIndex]?.line}</p>
                {pricingErr && <p className="text-[10px] text-rose-600 font-bold mb-2">{pricingErr}</p>}

                {/* اقتراحات الأسعار */}
                <div className="mb-3">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">
                      {(priceHistory[products[selectedPriceIndex]!.line] || []).length > 0 ? "اقتراحات من طلبات سابقة:" : "اقتراحات أسعار شائعة:"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(priceHistory[products[selectedPriceIndex]!.line] || [
                        { buyAlf: 0.5 }, { buyAlf: 0.75 }, { buyAlf: 1 }, { buyAlf: 1.25 }, { buyAlf: 1.5 }, { buyAlf: 2 }, { buyAlf: 3 }, { buyAlf: 5 }
                      ]).map((h, hi) => (
                        <button
                          key={hi}
                          type="button"
                          onClick={() => {
                            setPricingLinesText(String(h.buyAlf));
                            const buy = h.buyAlf;
                            const sell = calculateAutoSellPrice(products[selectedPriceIndex!]!.line, buy);
                            const nextProducts =[...products];
                            const target = nextProducts[selectedPriceIndex!];
                            if (target) {
                              nextProducts[selectedPriceIndex!] = { ...target, buyAlf: buy, sellAlf: sell, pricedBy: preparerName, pricedById: preparerId };
                              const nextJson = JSON.stringify(nextProducts.map(p => ({
                                line: p.line,
                                buyAlf: p.buyAlf === "" ? null : p.buyAlf,
                                sellAlf: p.sellAlf === "" ? null : p.sellAlf,
                                pricedBy: p.pricedBy,
                                pricedById: p.pricedById,
                                assignedPreparerId: p.assignedPreparerId,
                                assignedPreparerName: p.assignedPreparerName,
                              })));
                              setProducts(nextProducts);
                              performSave(nextJson);
                              setSelectedPriceIndex(null);
                              setPricingLinesText("");
                            }
                          }}
                          className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-black"
                        >
                          {h.buyAlf} 
                        </button>
                      ))}
                    </div>
                </div>

                {/* أزرار التسعير السريع المحدثة */}
                <div className="mb-4 space-y-3">
                  {!tempBasePrice ? (
                    <div className="grid grid-cols-5 gap-2 animate-in fade-in zoom-in-95 duration-200">
                      {[20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => { setTempBasePrice(n); setPricingLinesText(String(n)); }}
                          className="py-3 bg-slate-50 text-slate-800 rounded-xl text-sm font-black border border-slate-200 shadow-sm active:bg-indigo-600 active:text-white transition-all"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-indigo-50 p-3 rounded-2xl border-2 border-indigo-200 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <span className="text-xs font-black text-indigo-900">اختر الكسر لـ {tempBasePrice} :</span>
                        <button type="button" onClick={() => setTempBasePrice(null)} className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-sm">تغيير الرقم</button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[0, 0.25, 0.5, 0.75].map(frac => {
                          const total = tempBasePrice + frac;
                          return (
                            <button
                              key={frac}
                              type="button"
                              onClick={() => {
                                setPricingLinesText(String(total));
                                // حفظ فوري
                                const buy = total;
                                const sell = calculateAutoSellPrice(products[selectedPriceIndex!]!.line, buy);
                                const nextProducts = [...products];
                                const target = nextProducts[selectedPriceIndex!];
                                if (target) {
                                  nextProducts[selectedPriceIndex!] = { ...target, buyAlf: buy, sellAlf: sell, pricedBy: preparerName, pricedById: preparerId };
                                  const nextJson = JSON.stringify(nextProducts.map(p => ({
                                    line: p.line,
                                    buyAlf: p.buyAlf === "" ? null : p.buyAlf,
                                    sellAlf: p.sellAlf === "" ? null : p.sellAlf,
                                    pricedBy: p.pricedBy,
                                    pricedById: p.pricedById,
                                    assignedPreparerId: p.assignedPreparerId,
                                    assignedPreparerName: p.assignedPreparerName,
                                  })));
                                  setProducts(nextProducts);
                                  performSave(nextJson);
                                  setSelectedPriceIndex(null);
                                  setPricingLinesText("");
                                  setTempBasePrice(null);
                                }
                              }}
                              className="py-4 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-md active:scale-95 transition-all flex flex-col items-center justify-center"
                            >
                              <span>{total}</span>
                              {frac > 0 && <span className="text-[8px] opacity-80">+{frac}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <textarea
                  ref={pricingTextareaRef}
                  value={pricingLinesText}
                  onChange={(e) => setPricingLinesText(e.target.value)}
                  className={`${inputClass} text-center font-black text-lg`}
                  placeholder="سعر الشراء "
                  inputMode="decimal"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPricingPanel(); } }}
                />
                <div className="space-y-2 mt-3">
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={applyPricingPanel} className="bg-indigo-600 text-white rounded-xl py-3 text-sm font-black">حفظ السعر</button>
                        <button type="button" onClick={() => setSelectedPriceIndex(null)} className="bg-slate-100 text-slate-600 rounded-xl py-3 text-sm font-bold">إغلاق</button>
                    </div>
                    {products[selectedPriceIndex]?.buyAlf !== "" && (
                      <button
                        type="button"
                        onClick={unpriceProduct}
                        className="w-full bg-rose-50 text-rose-600 border border-rose-200 rounded-xl py-2.5 text-xs font-black active:bg-rose-600 active:text-white transition-all"
                      >
                        🗑️ إلغاء التسعير (إرجاع للحالة الأولى)
                      </button>
                    )}
                </div>
            </div>
        )}
      </section>

      {allProductsPriced && (
        <section className="kse-glass-dark rounded-2xl border border-amber-300 p-4 shadow-sm">
          <h2 className="text-sm font-black text-amber-950 mb-3">كم محل كلفك تجهيز الطلبية؟</h2>
          <div className="grid grid-cols-5 gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button key={n} type="button" onClick={() => { setPlacesCount(n); isDirtyRef.current = true; }} className={`rounded-xl py-3 text-sm font-black border-2 transition ${placesCount === n ? 'border-amber-600 bg-amber-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-800'}`}>{n}</button>
            ))}
          </div>
          {placesCount !== "" && <p className="mt-3 text-[10px] font-black text-emerald-700 bg-emerald-50 p-2 rounded-lg text-center">أحسنت! اكتملت القائمة. يمكنك الآن إرسال الطلب النهائي للنظام. (المجموع الكلي مع العمولات سيحسب تلقائياً)</p>}
        </section>
      )}

      <div className="fixed bottom-4 inset-x-4 z-50">
          <form action={submitAction}>
            <input type="hidden" name="p" value={auth.p} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="draftId" value={initialDraft.id} />
            <input type="hidden" name="placesCount" value={placesCount} />
            <input type="hidden" name="productsJson" value={productsJson} />
            <button type="submit" disabled={submitPending || !canSubmit || isDirtyRef.current} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 py-4 text-white font-black shadow-2xl active:scale-95 disabled:opacity-50 transition-all border-b-4 border-emerald-900">
                {isDirtyRef.current ? "⏳ جاري حفظ الأسعار..." : submitPending ? "جارٍ إرسال الطلب..." : "✅ إرسال الطلب النهائي للنظام 🚀"}
            </button>
          </form>
      </div>

      {/* الفقاعة العائمة لمجموع التسعير */}
      {bubbleMode === "floating" && (
        <div
          onMouseDown={onBubbleMouseDown}
          onTouchStart={onBubbleMouseDown}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            left: bubblePos.x,
            top: bubblePos.y,
            touchAction: 'none',
            transform: `scale(${bubbleSize})`,
            transformOrigin: 'center'
          }}
          className={`fixed z-[100] cursor-move select-none transition-shadow ${dragging ? 'shadow-2xl' : 'shadow-lg'}`}
        >
          <div className="flex flex-col items-center justify-center size-20 rounded-full bg-violet-600 text-white border-4 border-white shadow-xl animate-in zoom-in duration-300">
            <span className="text-4xl font-black leading-none tracking-tighter">{myTotalBuyAlf.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* شريط إعدادات الفقاعة */}
      {showBubbleSettings && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4">
            <h3 className="text-lg font-black text-slate-900 mb-4 text-center">إعدادات الفقاعة</h3>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block">حجم الفقاعة</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={bubbleSize}
                  onChange={(e) => setBubbleSize(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setBubbleMode(bubbleMode === "floating" ? "fixed" : "floating"); setShowBubbleSettings(false); }}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${bubbleMode === "fixed" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-100 bg-slate-50 text-slate-600"}`}
                >
                  <span className="text-xl">{bubbleMode === "fixed" ? "☁️" : "📍"}</span>
                  <span className="text-[10px] font-black">{bubbleMode === "fixed" ? "وضع عائم" : "وضع ثابت"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBubbleSettings(false)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-600"
                >
                  <span className="text-xl">✅</span>
                  <span className="text-[10px] font-black">تم</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {zoomImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <span className="font-bold text-slate-800 text-base">{zoomImage.title}</span>
              <button
                onClick={() => setZoomImage(null)}
                className="size-10 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 font-bold hover:bg-slate-300 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-1 bg-slate-200">
              <img
                src={resolvePublicAssetSrc(zoomImage.url)!}
                alt={zoomImage.title}
                className="w-full h-auto max-h-[75vh] object-contain rounded-2xl shadow-inner"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
