"use client";
// v5-clean-ui: تبسيط الواجهة وإزالة شريط البحث، مستوى الإنجاز، الفروع، السعر العائم، وتفاصيل الطلب

import { useActionState, useMemo, useRef, useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitPreparerShoppingDraft, updatePreparerShoppingDraft, reportUnavailableProductsAction, type PreparerActionState } from "@/app/preparer/actions";
import { suggestFixedPrices } from "@/lib/fixed-prices";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { calculateAutoSellPrice, isMeatProduct, parseQuantityFromLine } from "@/lib/auto-pricing";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { resolvePublicAssetSrc } from "@/lib/image-url";

const initial: PreparerActionState = {};
const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

type ProductRow = {
  line: string;
  buyAlf: number | "";
  actualBuyAlf?: number | "";
  sellAlf: number | "";
  pricedBy?: string | null;
  pricedById?: string | null;
  assignedPreparerId?: string | null;
  assignedPreparerName?: string | null;
  productId?: string | null;
  isFromStore?: boolean;
  qty?: number | null;
  quantity?: number | null;
  count?: number | null;
  deleted?: boolean;
};

function serializeProducts(list: ProductRow[]): string {
  return JSON.stringify(
    list.map((p) => ({
      line: p.line,
      buyAlf: p.buyAlf === "" ? null : p.buyAlf,
      actualBuyAlf: p.actualBuyAlf === "" ? null : p.actualBuyAlf,
      sellAlf: p.sellAlf === "" ? null : p.sellAlf,
      pricedBy: p.pricedBy,
      pricedById: p.pricedById,
      assignedPreparerId: p.assignedPreparerId,
      assignedPreparerName: p.assignedPreparerName,
      productId: p.productId,
      isFromStore: p.isFromStore,
      qty: p.qty,
      quantity: p.quantity,
      count: p.count,
      deleted: Boolean(p.deleted),
    }))
  );
}

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
    const actBRaw = r.actualBuyAlf;
    const sRaw = r.sellAlf;

    const bNum = (bRaw === null || bRaw === undefined || bRaw === "") ? "" : Number(bRaw);
    const actBNum = (actBRaw === null || actBRaw === undefined || actBRaw === "") ? "" : Number(actBRaw);
    const sNum = (sRaw === null || sRaw === undefined || sRaw === "") ? "" : Number(sRaw);

    const itemQty = r.qty ?? r.quantity ?? r.count;
    const parsedQty = parseQuantityFromLine(line);
    const resolvedQty = itemQty != null && !isNaN(Number(itemQty)) && Number(itemQty) > 0 
      ? Number(itemQty) 
      : (parsedQty > 0 ? parsedQty : 1);

    results.push({
      line,
      buyAlf: (typeof bNum === "number" && Number.isFinite(bNum)) ? bNum : "",
      actualBuyAlf: (typeof actBNum === "number" && Number.isFinite(actBNum)) ? actBNum : "",
      sellAlf: (typeof sNum === "number" && Number.isFinite(sNum)) ? sNum : "",
      pricedBy: typeof r.pricedBy === "string" ? r.pricedBy : (typeof r.pricedByName === "string" ? r.pricedByName : null),
      pricedById: typeof r.pricedById === "string" ? r.pricedById : null,
      assignedPreparerId: typeof r.assignedPreparerId === "string" ? r.assignedPreparerId : null,
      assignedPreparerName: typeof r.assignedPreparerName === "string" ? r.assignedPreparerName : null,
      productId: typeof r.productId === "string" ? r.productId : (typeof r.id === "string" ? r.id : null),
      isFromStore: !!r.isFromStore,
      qty: resolvedQty,
      quantity: resolvedQty,
      count: resolvedQty,
      deleted: Boolean(r.deleted || r.isDeleted),
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
  const draftMetadata =
    initialDraft.data && typeof initialDraft.data === "object" && !Array.isArray(initialDraft.data)
      ? initialDraft.data as Record<string, unknown>
      : {};
  const selectedSupplierNames = Array.isArray(draftMetadata.selectedSuppliers)
    ? draftMetadata.selectedSuppliers
        .map((supplier) => {
          if (!supplier || typeof supplier !== "object") return "";
          const name = (supplier as Record<string, unknown>).name;
          return typeof name === "string" ? name.trim() : "";
        })
        .filter(Boolean)
    : [];
  const [customDeliveryAlf, setCustomDeliveryAlf] = useState<string>(() => {
    const d = initialDraft.data as any;
    return (d && d.customDeliveryAlf != null) ? String(d.customDeliveryAlf) : "";
  });
  const [noProfit, setNoProfit] = useState(!!(initialDraft.data as any)?.noProfit);
  const [products, setProducts] = useState<ProductRow[]>(() => parseProducts(initialDraft.data));

  const isStoreOrder = useMemo(() => {
    const t = (titleLine || initialDraft.titleLine || "").toString().toLowerCase();
    const subSource = (initialDraft as any)?.submissionSource || (initialDraft.data as any)?.submissionSource;
    return subSource === "web_store" || t.includes("متجر") || t.includes("store");
  }, [titleLine, initialDraft]);

  const handleToggleNoProfit = (newVal: boolean) => {
    setNoProfit(newVal);
    const updatedProducts = products.map(p => {
      if (typeof p.buyAlf === "number" && p.buyAlf > 0) {
        return {
          ...p,
          sellAlf: calculateAutoSellPrice(p.line, p.buyAlf, newVal)
        };
      }
      return p;
    });
    setProducts(updatedProducts);

    // Auto-save progress
    const nextJson = JSON.stringify(updatedProducts.map(pp => ({
        line: pp.line,
        buyAlf: pp.buyAlf === "" ? null : pp.buyAlf,
        sellAlf: pp.sellAlf === "" ? null : pp.sellAlf,
        pricedBy: pp.pricedBy,
        pricedById: pp.pricedById,
        assignedPreparerId: pp.assignedPreparerId,
        assignedPreparerName: pp.assignedPreparerName,
    })));
    performSave(nextJson, newVal);
  };
  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeBranch, setActiveBranch] = useState<string | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [sortError, setSortError] = useState<string | null>(null);

  async function handleAiSort() {
    if (products.length === 0) return;
    setIsSorting(true);
    setSortError(null);
    try {
      const textToSend = products.map(p => p.line).join("\n");
      const res = await fetch("/api/ai/sort-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend })
      });
      const data = await res.json();
      if (data.error) {
        setSortError(data.error);
      } else if (data.sortedText) {
        const sortedLines = data.sortedText
          .split("\n")
          .map((l: string) => l.trim())
          .filter(Boolean);

        const newProducts: ProductRow[] = [];
        sortedLines.forEach((line: string) => {
          const matchedOriginal = products.find(
            (orig) => orig.line.trim().toLowerCase() === line.toLowerCase()
          );
          if (matchedOriginal) {
            newProducts.push({
              ...matchedOriginal
            });
          } else {
            newProducts.push({
              line,
              buyAlf: "",
              sellAlf: "",
              pricedBy: null,
              pricedById: null,
              assignedPreparerId: null,
              assignedPreparerName: null,
              productId: null,
              isFromStore: false
            });
          }
        });

        // لضمان الأمان وعدم ضياع أي منتج
        products.forEach((orig) => {
          if (!newProducts.some((p) => p.line.toLowerCase() === orig.line.toLowerCase())) {
            newProducts.push(orig);
          }
        });

        setProducts(newProducts);

        const nextJson = JSON.stringify(newProducts.map(p => ({
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
    } catch (err) {
      setSortError("فشل الاتصال بخدمة الترتيب.");
    } finally {
      setIsSorting(false);
    }
  }

  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  // السماح بالسحب للتحديث

  // --- إجبار الكيبورد على البقاء مفتوحاً عند الانتقال بين المواد ---
  useEffect(() => {
    if (selectedPriceIndex !== null) {
      // ننتظر جزء بسيط جداً من الثانية لضمان ظهور النافذة في المتصفح ثم نطلب الكيبورد
      const timer = setTimeout(() => {
        pricingTextareaRef.current?.focus();
        // لضمان التمرير في الموبايل ليكون الحقل واضحاً
        pricingTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedPriceIndex]);

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
      if (!p.deleted && typeof p.buyAlf === "number" && p.pricedById === preparerId) {
        return sum + p.buyAlf;
      }
      return sum;
    }, 0);
  }, [products, preparerId]);

  const onBubbleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopPropagation();
    }

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

  const onBubbleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging || showBubbleSettings || bubbleMode !== "floating") return;
    
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopPropagation();
    }
    if (e.cancelable) e.preventDefault();

    const pos = e.touches[0];
    setBubblePos({
      x: Math.max(0, Math.min(window.innerWidth - 80, pos.clientX - rel.x)),
      y: Math.max(0, Math.min(window.innerHeight - 80, pos.clientY - rel.y))
    });
  }, [dragging, rel, showBubbleSettings, bubbleMode]);

  const onBubbleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopPropagation();
    }
    onBubbleMouseUp();
  }, [onBubbleMouseUp]);

  useEffect(() => {
    const onMouseMove = (e: any) => {
      if (!dragging || showBubbleSettings || bubbleMode !== "floating") return;
      const pos = e;
      setBubblePos({
        x: Math.max(0, Math.min(window.innerWidth - 80, pos.clientX - rel.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, pos.clientY - rel.y))
      });
    };

    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onBubbleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onBubbleMouseUp);
    };
  }, [dragging, rel, showBubbleSettings, bubbleMode, onBubbleMouseUp]);

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
      if (p) {
        fetchPriceHistory(p.line);
        setActualBuyText(p.actualBuyAlf !== "" && p.actualBuyAlf != null ? String(p.actualBuyAlf) : "");
        setPricingLinesText(p.buyAlf !== "" ? String(p.buyAlf) : "");
      }
    } else {
      setActualBuyText("");
    }
  }, [selectedPriceIndex, products, fetchPriceHistory]);
  // -----------------------------
  const [pricingLinesText, setPricingLinesText] = useState("");
  const [actualBuyText, setActualBuyText] = useState("");
  const [pricingErr, setPricingErr] = useState<string | null>(null);
  const pricingTextareaRef = useRef<HTMLTextAreaElement>(null);

  const[deleteMode, setDeleteMode] = useState(false);
  const [showAddProductsPanel, setShowAddProductsPanel] = useState(false);
  const [addProductsText, setAddProductsText] = useState("");
  const isDirtyRef = useRef(false);
  const lastSavedJsonRef = useRef(JSON.stringify(products));

  // --- Unavailable Products Feature ---
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [unavailableSelection, setUnavailableSelection] = useState<Record<number, string>>({}); // idx -> substitute
  const [reportState, reportAction, reportPending] = useActionState(reportUnavailableProductsAction, initial);

  const toggleUnavailableItem = (idx: number) => {
    setUnavailableSelection(prev => {
      const next = { ...prev };
      if (next[idx] !== undefined) delete next[idx];
      else next[idx] = "";
      return next;
    });
  };

  const updateSubstitute = (idx: number, val: string) => {
    setUnavailableSelection(prev => ({ ...prev, [idx]: val }));
  };

  const handleSendUnavailable = async () => {
    const items = Object.entries(unavailableSelection).map(([idx, sub]) => ({
      line: products[Number(idx)].line,
      substitute: sub.trim() || undefined,
    }));
    if (items.length === 0) return;

    const fd = new FormData();
    fd.append("p", auth.p);
    fd.append("exp", auth.exp);
    fd.append("s", auth.s);
    fd.append("preparerName", preparerName);
    fd.append("customerRegion", titleLine || initialDraft.customerRegion?.name || "—");
    fd.append("customerPhone", customerPhone);
    fd.append("itemsJson", JSON.stringify(items));

    // Telegram Notification
    startAutoSave(async () => {
        await reportAction(fd);
    });

    // WhatsApp Notification
    const waPhone = "9647733921468";
    const waText = [
      `⚠️ *مواد غير متوفرة*`,
      `*المجهز:* ${preparerName}`,
      `*المنطقة:* ${titleLine || initialDraft.customerRegion?.name || "—"}`,
      `*هاتف الزبون:* ${customerPhone}`,
      `-------------------------`,
      `*المواد:*`,
      ...items.map(i => `• ${i.line}${i.substitute ? ` (البديل: ${i.substitute})` : " (بدون بديل)"}`),
    ].join("\n");

    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`;
    window.open(waUrl, "_blank");

    setShowUnavailableModal(false);
    setUnavailableSelection({});
  };
  // ------------------------------------

  // التحويل التلقائي عند نجاح الإرسال
  useEffect(() => {
    if (submitState.ok) {
        const t = setTimeout(() => {
            router.push(preparerPath("/preparer", auth));
        }, 1500);
        return () => clearTimeout(t);
    }
  }, [submitState.ok, router, auth]);

  const activeProducts = useMemo(() => products.filter((p) => !p.deleted), [products]);
  const allProductsPriced = activeProducts.length > 0 && activeProducts.every((p) => p.buyAlf !== "" && p.sellAlf !== "");

  const productsJson = useMemo(() => serializeProducts(products), [products]);

  const performSave = useCallback(async (jsonToSave: string, overrideNoProfit?: boolean) => {
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
        fd.append("deliveryPrice", customDeliveryAlf);
        fd.append("productsJson", jsonToSave);
        fd.append("noProfit", (overrideNoProfit !== undefined ? overrideNoProfit : noProfit) ? "true" : "false");

        updatePreparerShoppingDraft(initial, fd).then(res => {
            if (res.ok) {
                isDirtyRef.current = false;
                lastSavedJsonRef.current = jsonToSave;
            }
        }).catch(console.error);
    });
  },[auth, initialDraft.id, titleLine, customerPhone, customerName, customerLandmark, orderTime, placesCount, customDeliveryAlf, noProfit]);


  function addProductsFromText() {
    const lines = addProductsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const next: ProductRow[] =[
        ...products,
        ...lines.map((line) => ({ line, buyAlf: "" as const, sellAlf: "" as const, pricedBy: null, pricedById: null, assignedPreparerId: null, assignedPreparerName: null, deleted: false })),
    ];
    setProducts(next);
    performSave(serializeProducts(next));
    setAddProductsText("");
    setShowAddProductsPanel(false);
  }

  function toggleDeleteProductByIndex(idx: number) {
    const next = products.map((p, i) => {
      if (i !== idx) return p;
      return { ...p, deleted: !p.deleted };
    });
    setProducts(next);
    performSave(serializeProducts(next));
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
            const ld = latest.data as any;
            if (ld && ld.customDeliveryAlf != null) {
                setCustomDeliveryAlf(String(ld.customDeliveryAlf));
            }
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
  },[titleLine, customerPhone, customerName, customerLandmark, orderTime, placesCount, customDeliveryAlf, performSave, productsJson]);

  const stats = useMemo(() => {
    const active = products.filter(p => !p.deleted);
    const total = active.length;
    const priced = active.filter(p => p.buyAlf !== "" && p.sellAlf !== "").length;
    const percent = total > 0 ? Math.round((priced / total) * 100) : 0;
    return { total, priced, percent };
  }, [products]);

  const branches = useMemo(() => {
    const bSet = new Set<string>();
    products.forEach(p => {
      const b = productBranchMap[p.line.trim().toLowerCase()] || "أخرى";
      bSet.add(b);
    });
    return Array.from(bSet).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [products, productBranchMap]);

  const orderedForButtons = useMemo(() => {
    const withIndex = products.map((p, idx) => ({
      p,
      idx,
      branch: productBranchMap[p.line.trim().toLowerCase()] || "أخرى"
    }));

    // تطبيق فلتر البحث
    let filtered = searchTerm.trim()
      ? withIndex.filter(item => item.p.line.toLowerCase().includes(searchTerm.toLowerCase()))
      : withIndex;

    // تطبيق فلتر الفرع
    if (activeBranch) {
      filtered = filtered.filter(item => item.branch === activeBranch);
    }

    return filtered.sort((a, b) => {
      // -1. المواد غير الممسوحة تظهر أولاً، والمواد الممسوحة تذهب للأسفل
      const aDel = Boolean(a.p.deleted);
      const bDel = Boolean(b.p.deleted);
      if (aDel !== bDel) {
        return aDel ? 1 : -1;
      }

      // 0. المواد المسندة للمجهز الحالي ("لك") تظهر في الأعلام أولاً في الطلب المشترك
      const getPrepRank = (item: typeof a) => {
        const assigned = item.p.assignedPreparerId;
        if (assigned && assigned === preparerId) return 1; // "لك" في القمة أولاً
        if (!assigned) return 2; // مادة غير مسندة لمجهز محدد
        return 3; // مسندة لمجهز آخر
      };

      const rankA = getPrepRank(a);
      const rankB = getPrepRank(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      const aPriced = a.p.buyAlf !== "" && a.p.sellAlf !== "";
      const bPriced = b.p.buyAlf !== "" && b.p.sellAlf !== "";

      // 1. المواد المسعرة تظهر أولاً
      if (aPriced !== bPriced) {
        return aPriced ? -1 : 1;
      }

      // 2. الترتيب حسب اسم الفرع/المحل
      if (a.branch !== b.branch) {
        return a.branch.localeCompare(b.branch, 'ar');
      }

      // 3. الترتيب الأصلي
      return a.idx - b.idx;
    });
  }, [products, productBranchMap, searchTerm, activeBranch, preparerId]);

  function applyPricingPanel(goToNext = false) {
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
    const actBuyNum = actualBuyText.trim() ? parseFloat(actualBuyText.replace(/,/g, ".").trim()) : NaN;
    const actualBuy = (!isNaN(actBuyNum) && Number.isFinite(actBuyNum) && actBuyNum >= 0) ? actBuyNum : "";

    let sell = lines[1] ? parseFloat(lines[1]) : calculateAutoSellPrice(products[selectedPriceIndex]!.line, buy, noProfit);

    const nextProducts =[...products];
    const target = nextProducts[selectedPriceIndex];
    if (target) {
        nextProducts[selectedPriceIndex] = { ...target, buyAlf: buy, actualBuyAlf: actualBuy, sellAlf: sell, pricedBy: preparerName, pricedById: preparerId };
        const nextJson = JSON.stringify(nextProducts.map(p => ({
            line: p.line,
            buyAlf: p.buyAlf === "" ? null : p.buyAlf,
            actualBuyAlf: p.actualBuyAlf === "" ? null : p.actualBuyAlf,
            sellAlf: p.sellAlf === "" ? null : p.sellAlf,
            pricedBy: p.pricedBy,
            pricedById: p.pricedById,
            assignedPreparerId: p.assignedPreparerId,
            assignedPreparerName: p.assignedPreparerName,
        })));
        setProducts(nextProducts);
        performSave(nextJson);
    }

    if (goToNext) {
        // البحث عن المادة التالية غير المسعرة بناءً على الترتيب الظاهر (البصري)
        const currentVisualIdx = orderedForButtons.findIndex(item => item.idx === selectedPriceIndex);
        const nextVisualItem = orderedForButtons.slice(currentVisualIdx + 1).find(item => item.p.buyAlf === "" || item.p.sellAlf === "");

        if (nextVisualItem) {
            setSelectedPriceIndex(nextVisualItem.idx);
            setPricingLinesText("");
            setActualBuyText("");
        } else {
            setSelectedPriceIndex(null);
            setPricingLinesText("");
            setActualBuyText("");
        }
    } else {
        setSelectedPriceIndex(null);
        setPricingLinesText("");
        setActualBuyText("");
    }
  }

  function unpriceProduct() {
    if (selectedPriceIndex === null) return;
    const nextProducts = [...products];
    const target = nextProducts[selectedPriceIndex];
    if (target) {
      nextProducts[selectedPriceIndex] = { ...target, buyAlf: "", actualBuyAlf: "", sellAlf: "", pricedBy: null, pricedById: null };
      const nextJson = JSON.stringify(nextProducts.map(p => ({
        line: p.line,
        buyAlf: p.buyAlf === "" ? null : p.buyAlf,
        actualBuyAlf: p.actualBuyAlf === "" ? null : p.actualBuyAlf,
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
    setActualBuyText("");
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
    }
  }

  function handleSelectPlacesCountAndSubmit(n: number) {
    if (submitPending) return;
    setPlacesCount(n);
    isDirtyRef.current = true;

    const fd = new FormData();
    fd.append("p", auth.p);
    fd.append("exp", auth.exp);
    fd.append("s", auth.s);
    fd.append("draftId", initialDraft.id);
    fd.append("placesCount", String(n));
    fd.append("productsJson", productsJson);
    fd.append("noProfit", noProfit ? "true" : "false");

    submitAction(fd);
  }

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
    <div className="space-y-4 max-w-lg mx-auto" dir="rtl">
      {/* الشريط العلوي المدمج: زر رجوع عادي + اسم المنطقة + زر إيقاف الربح + شارة الحفظ وشعار وصلي */}
      <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-[0_4px_12px_rgba(0,123,255,0.06)] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={preparerPath("/preparer/preparation", auth)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-black text-slate-700 shadow-2xs active:scale-95 transition"
          >
            <span className="text-sm">←</span>
            <span>رجوع</span>
          </Link>

          <span className="text-sm font-black text-[#004085] bg-sky-50 px-2.5 py-1 rounded-xl border border-sky-100">
            {initialDraft.customerRegion?.name || "عام"}
          </span>

          <button
            type="button"
            onClick={() => handleToggleNoProfit(!noProfit)}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition shadow-2xs active:scale-95 ${
              noProfit
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            {noProfit ? "🚫 بدون ربح" : "🚫 إيقاف الربح"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-[#e8f5e9] text-[#28a745]">
            {isAutoSaving || isDirtyRef.current ? (
              <span className="text-amber-600 font-bold animate-pulse text-[11px]">⏳ جاري الحفظ...</span>
            ) : (
              <>
                <span>✓</span>
                <span className="hidden sm:inline text-[11px]">تم الحفظ</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm sm:text-base font-black text-[#007bff]">
            <span className="text-amber-400 text-base sm:text-lg">⚡</span>
            <span>وصلي</span>
          </div>
        </div>
      </div>

      {/* الموردون المختارون من الإدارة إن وجدوا */}
      {selectedSupplierNames.length > 0 && (
        <section className="bg-white rounded-2xl border border-sky-100 p-3 shadow-xs">
          <h2 className="text-xs font-black text-sky-950">الموردون الذين اختارتهم الإدارة:</h2>
          <p className="mt-1 text-xs font-semibold text-slate-700">{selectedSupplierNames.join("، ")}</p>
        </section>
      )}

        {/* شبكة العمليات 4 أزرار متطابقة مع التصميم المطلوب */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {/* زر حذف / استرجاع */}
          <button
            type="button"
            onClick={() => { setDeleteMode(!deleteMode); setShowAddProductsPanel(false); }}
            className={`border-none rounded-xl p-2.5 text-xs font-bold cursor-pointer flex flex-col items-center justify-center gap-1 transition ${
              deleteMode
                ? "bg-rose-600 text-white shadow-md animate-pulse"
                : "bg-[#ffe6e6] text-[#dc3545] hover:bg-rose-100"
            }`}
          >
            <span className="text-sm">🗑️</span>
            <span className="text-[11px] leading-tight">{deleteMode ? "إيقاف" : "حذف/استرجاع"}</span>
          </button>

          {/* زر غير متوفر */}
          <button
            type="button"
            onClick={() => setShowUnavailableModal(true)}
            className="border-none rounded-xl p-2.5 text-xs font-bold cursor-pointer flex flex-col items-center justify-center gap-1 bg-[#ffc107] text-amber-950 hover:bg-amber-400 transition"
          >
            <span className="text-sm">🚫</span>
            <span className="text-[11px] leading-tight">غير متوفر</span>
          </button>

          {/* زر مادة + */}
          <button
            type="button"
            onClick={() => { setShowAddProductsPanel(!showAddProductsPanel); setDeleteMode(false); }}
            className="border-none rounded-xl p-2.5 text-xs font-bold cursor-pointer flex flex-col items-center justify-center gap-1 bg-[#28a745] text-white hover:bg-emerald-600 transition"
          >
            <span className="text-sm font-black">+</span>
            <span className="text-[11px] leading-tight">مادة +</span>
          </button>

          {/* بلوك السعر الكلي */}
          <div
            onClick={() => {
              if (bubbleMode === "fixed") {
                // فتح إعدادات الفقاعة أو التبديل
              }
            }}
            className="bg-gradient-to-br from-[#007bff] to-[#0056b3] rounded-xl p-2 flex flex-col items-center justify-center text-white shadow-[0_4px_8px_rgba(0,123,255,0.2)] select-none"
          >
            <span className="text-[10px] opacity-90 font-semibold leading-tight">السعر الكلي</span>
            <span className="text-[13px] font-black text-[#ffc107] tracking-tight leading-tight mt-0.5">
              {(myTotalBuyAlf * 1000).toLocaleString('ar-IQ')} د.ع
            </span>
          </div>
        </div>



      {sortError && (
        <p className="text-center text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200">
          {sortError}
        </p>
      )}

      {/* لوحة إضافة المواد */}
      {showAddProductsPanel && (
        <div className="p-3 bg-white rounded-xl border-2 border-emerald-300 shadow-sm space-y-2">
          <textarea
            value={addProductsText}
            onChange={(e) => setAddProductsText(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="اكتب المواد الجديدة هنا (كل مادة بسطر)..."
          />
          <button
            type="button"
            onClick={addProductsFromText}
            className="w-full bg-[#28a745] text-white rounded-lg py-2 text-xs font-black hover:bg-emerald-700 transition"
          >
            إضافة للمجموعة
          </button>
        </div>
      )}

      {/* شبكة بطاقات المنتجات وفق التصميم المطلوب */}
      <div className="grid grid-cols-2 gap-2.5">
        {orderedForButtons.map(({ p, idx: i }) => {
          const isDeleted = Boolean(p.deleted);
          const isMeat = isMeatProduct(p.line);
          const priced = p.buyAlf !== "" && p.sellAlf !== "";
          const isAssignedToOther = Boolean(p.assignedPreparerId && p.assignedPreparerId !== preparerId);
          const isPricedByOther = Boolean(priced && p.pricedById && p.pricedById !== preparerId && p.pricedById !== "auto");
          const isOthers = isAssignedToOther || isPricedByOther;
          const active = i === selectedPriceIndex;

          const itemQty = p.qty ?? p.quantity;
          const parsedQty = parseQuantityFromLine(p.line || "");
          const displayQty = itemQty && Number(itemQty) > 0 ? Number(itemQty) : (parsedQty && Number(parsedQty) > 0 ? Number(parsedQty) : 1);

          // إذا كانت المادة محذوفة: تظهر كـ deleted-card كما في التصميم المطلوب
          if (isDeleted) {
            return (
              <div
                key={`${i}-${p.line}`}
                className="bg-[#fffdfd] border-2 border-dashed border-[#f5c6cb] rounded-xl p-2.5 min-h-[70px] flex flex-col justify-between shadow-2xs select-none"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-[#dc3545] font-bold line-through truncate" title={p.line}>
                    {p.line}
                  </span>
                  <span className="text-[#dc3545] text-xs">🗑️</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleDeleteProductByIndex(i)}
                  className="bg-[#28a745] hover:bg-emerald-600 text-white border-none px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer flex items-center gap-1 w-fit transition active:scale-95"
                >
                  <span>↩️</span>
                  <span>استرجاع</span>
                </button>
              </div>
            );
          }

          // بطاقة المنتج النشطة
          return (
            <div
              key={`${i}-${p.line}`}
              onClick={() => {
                if (deleteMode) { toggleDeleteProductByIndex(i); return; }
                if (isMeat) {
                  if (!priced) handleAutoPriceMeat(i);
                  return;
                }
                if (isAssignedToOther || isPricedByOther) return;
                setSelectedPriceIndex(i);
                setPricingLinesText(priced ? `${p.buyAlf}` : "");
              }}
              className={`bg-white border rounded-xl p-2.5 min-h-[70px] flex flex-col justify-between cursor-pointer transition-all duration-200 select-none shadow-xs hover:-translate-y-0.5 hover:shadow-md ${
                active
                  ? "border-[#007bff] ring-2 ring-sky-200"
                  : isOthers
                  ? "border-slate-200 bg-slate-50 opacity-50 grayscale cursor-not-allowed"
                  : priced
                  ? "border-emerald-300 bg-emerald-50/20"
                  : "border-slate-200 hover:border-[#007bff]"
              }`}
            >
              {/* اسم المنتج والصورة */}
              <div className="flex items-start gap-1.5 w-full">
                {productImagesMap[p.line.trim().toLowerCase()] && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomImage({
                        url: productImagesMap[p.line.trim().toLowerCase()],
                        title: p.line
                      });
                    }}
                    className="shrink-0 size-7 rounded-md overflow-hidden border border-slate-200 bg-slate-50 cursor-zoom-in"
                  >
                    <img
                      src={resolvePublicAssetSrc(productImagesMap[p.line.trim().toLowerCase()])!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-[#004085] truncate leading-tight" title={p.line}>
                    {p.line}
                  </div>
                </div>
              </div>

              {/* سطر التفاصيل السفلي: شارة الملكية أو السعر والكمية */}
              <div className="flex items-center justify-between gap-1 mt-1">
                <div className="flex items-center gap-1">
                  {isAssignedToOther ? (
                    <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-200">
                      {p.assignedPreparerName || "آخر"}
                    </span>
                  ) : p.assignedPreparerId === preparerId ? (
                    <span className="bg-[#e8f5e9] text-[#28a745] text-[10px] font-bold px-1.5 py-0.5 rounded">
                      لك
                    </span>
                  ) : priced ? (
                    <span className="bg-emerald-600 text-white font-mono text-[11px] font-bold px-1.5 py-0.5 rounded">
                      {p.buyAlf} ألف
                    </span>
                  ) : (
                    <span className="bg-[#e8f5e9] text-[#28a745] text-[10px] font-bold px-1.5 py-0.5 rounded">
                      لك
                    </span>
                  )}

                  {isMeat && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                      🥩 لحم
                    </span>
                  )}
                </div>

                <div className="bg-[#f4f7fb] text-[#004085] text-[11px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                  ×{displayQty}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* نافذة التسعير المنبثقة السلسة المأخوذة من التصميم */}
      {selectedPriceIndex !== null && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 flex justify-center items-start overflow-y-auto p-0 sm:p-4 transition-all duration-300"
          onClick={() => setSelectedPriceIndex(null)}
        >
          <div
            className="bg-white w-full max-w-[480px] rounded-b-[24px] sm:rounded-3xl p-5 shadow-2xl transition-transform duration-300 max-h-[95vh] overflow-y-auto mt-0 animate-in slide-in-from-top-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس المودال: زر إغلاق، اسم المنتج بالمنتصف عريض جداً */}
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={() => setSelectedPriceIndex(null)}
                className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
              >
                ✕
              </button>
              <div className="text-[22px] font-black text-[#004085] text-center flex-1 truncate px-2">
                {products[selectedPriceIndex]?.line}
              </div>
              <div className="w-8"></div>
            </div>

            {pricingErr && (
              <p className="text-xs text-rose-600 font-bold mb-3 p-2 bg-rose-50 rounded-xl border border-rose-200 text-center">
                ⚠️ {pricingErr}
              </p>
            )}

            {/* صندوق أزرار الكسور السريعة ذكي وديناميكي */}
            {(() => {
              const typedValue = parseFloat(pricingLinesText);
              const hasTyped = !isNaN(typedValue) && typedValue >= 0 && pricingLinesText.trim() !== "";

              if (!hasTyped) {
                // المجهز لم يكتب رقماً بعد: نعرض مقترحات سريعة أو أسعار شائعة دون فرض الرقم 5
                const suggestions = (priceHistory[products[selectedPriceIndex]!.line] || [
                  { buyAlf: 0.5 }, { buyAlf: 0.75 }, { buyAlf: 1 }, { buyAlf: 1.5 }, { buyAlf: 2 }, { buyAlf: 2.5 }, { buyAlf: 3 }, { buyAlf: 4 }
                ]);

                return (
                  <div className="bg-[#f0f7ff] border border-[#cce5ff] rounded-2xl p-3 mb-4">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-bold text-[#004085]">أسعار مقترحة سريعة:</span>
                      <span className="text-[10px] text-slate-400">أو اكتب الرقم لتظهر كسوره</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.slice(0, 8).map((s, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const buy = s.buyAlf;
                            const sell = calculateAutoSellPrice(products[selectedPriceIndex!]!.line, buy, noProfit);
                            const nextProducts = [...products];
                            const target = nextProducts[selectedPriceIndex!];
                            if (target) {
                              nextProducts[selectedPriceIndex!] = {
                                ...target,
                                buyAlf: buy,
                                sellAlf: sell,
                                pricedBy: preparerName,
                                pricedById: preparerId
                              };
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

                              const currentVisualIdx = orderedForButtons.findIndex(item => item.idx === selectedPriceIndex);
                              const nextVisualItem = orderedForButtons.slice(currentVisualIdx + 1).find(item => item.p.buyAlf === "" || item.p.sellAlf === "");
                              if (nextVisualItem) {
                                setSelectedPriceIndex(nextVisualItem.idx);
                                setPricingLinesText("");
                                pricingTextareaRef.current?.focus();
                              } else {
                                setSelectedPriceIndex(null);
                                setPricingLinesText("");
                              }
                            }
                          }}
                          className="bg-white border border-[#cce5ff] text-[#007bff] hover:bg-[#007bff] hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-black shadow-2xs transition active:scale-95"
                        >
                          {s.buyAlf} ألف
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              // إذا كتب المجهز رقماً: تظهر أزرار الكسور بناًء على الرقم المكتوب
              const base = Math.floor(typedValue);
              const fractions = [0, 0.25, 0.5, 0.75];

              return (
                <div className="bg-[#f0f7ff] border border-[#cce5ff] rounded-2xl p-3 mb-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[11px] font-black text-[#004085]">إكمال السعر لـ ({base}):</span>
                    <span className="text-[10px] font-bold text-[#007bff] animate-pulse">انقر للكسر والحفظ الفوري</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {fractions.map((frac, fIdx) => {
                      const totalVal = base + frac;
                      const isCurrent = totalVal === typedValue;

                      return (
                        <button
                          key={frac}
                          type="button"
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const buy = totalVal;
                            const sell = calculateAutoSellPrice(products[selectedPriceIndex!]!.line, buy, noProfit);
                            const nextProducts = [...products];
                            const target = nextProducts[selectedPriceIndex!];
                            if (target) {
                              nextProducts[selectedPriceIndex!] = {
                                ...target,
                                buyAlf: buy,
                                sellAlf: sell,
                                pricedBy: preparerName,
                                pricedById: preparerId
                              };
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

                              // الانتقال للمادة التالية
                              const currentVisualIdx = orderedForButtons.findIndex(item => item.idx === selectedPriceIndex);
                              const nextVisualItem = orderedForButtons.slice(currentVisualIdx + 1).find(item => item.p.buyAlf === "" || item.p.sellAlf === "");
                              if (nextVisualItem) {
                                setSelectedPriceIndex(nextVisualItem.idx);
                                setPricingLinesText("");
                                pricingTextareaRef.current?.focus();
                              } else {
                                setSelectedPriceIndex(null);
                                setPricingLinesText("");
                              }
                            }
                          }}
                          className={`border-none rounded-xl py-2.5 px-1 text-center cursor-pointer transition active:scale-95 ${
                            fIdx === 0 && !isCurrent
                              ? "bg-[#80b3ff] text-white"
                              : isCurrent
                              ? "bg-[#0056b3] text-white"
                              : "bg-[#007bff] hover:bg-[#0056b3] text-white"
                          }`}
                        >
                          <span className="text-[15px] font-black block">{totalVal}</span>
                          {frac > 0 && <span className="text-[10px] opacity-80 block">+{frac}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* حقول الأسعار في سطرين مدمجين */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#004085] block">سعر الشراء (للزبون):</label>
                <div className="relative">
                  <input
                    ref={pricingTextareaRef as any}
                    value={pricingLinesText}
                    onChange={(e) => setPricingLinesText(e.target.value)}
                    className="w-full border-2 border-[#007bff] rounded-xl py-2.5 px-3 text-base font-extrabold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="0"
                    inputMode="decimal"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPricingPanel(true); } }}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-semibold pointer-events-none">
                    ألف
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#b78103] block">المدفوع للمحل (محفظة):</label>
                <div className="relative">
                  <input
                    value={actualBuyText}
                    onChange={(e) => setActualBuyText(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-base font-extrabold text-slate-600 bg-[#f8fafc] outline-none focus:border-amber-400"
                    placeholder={pricingLinesText ? `${pricingLinesText.split('\n')[0]} (تلقائي)` : "0"}
                    inputMode="decimal"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPricingPanel(true); } }}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-amber-500 font-semibold pointer-events-none">
                    ألف
                  </span>
                </div>
              </div>
            </div>

            {/* أزرار الإجراءات في المودال */}
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  applyPricingPanel(true);
                  pricingTextareaRef.current?.focus();
                }}
                className="flex-1 bg-[#28a745] hover:bg-emerald-600 text-white border-none py-3.5 px-4 rounded-xl font-extrabold text-sm cursor-pointer flex items-center justify-center gap-1.5 transition active:scale-98 shadow-sm"
              >
                <span>حفظ والتالي</span>
                <span>←</span>
              </button>
              <button
                type="button"
                onClick={() => applyPricingPanel(false)}
                className="flex-1 bg-[#007bff] hover:bg-blue-600 text-white border-none py-3.5 px-4 rounded-xl font-extrabold text-sm cursor-pointer transition active:scale-98 shadow-sm"
              >
                حفظ وإغلاق
              </button>
            </div>

            <div className="flex items-center justify-between mt-3">
              {products[selectedPriceIndex]?.buyAlf !== "" && (
                <button
                  type="button"
                  onClick={unpriceProduct}
                  className="text-xs text-rose-600 font-bold hover:underline"
                >
                  مسح السعر 🗑️
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedPriceIndex(null)}
                className="w-full text-center bg-transparent text-slate-400 hover:text-slate-600 border-none py-2 font-bold text-xs cursor-pointer"
              >
                إلغاء وتراجع
              </button>
            </div>
          </div>
        </div>
      )}


      {allProductsPriced && (
        <section className="kse-glass-dark rounded-2xl border border-amber-300 p-4 shadow-sm">
          <h2 className="text-sm font-black text-amber-950 mb-3">كم محل كلفك تجهيز الطلبية؟</h2>
          <div className="grid grid-cols-5 gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                key={n}
                type="button"
                disabled={submitPending}
                onClick={() => handleSelectPlacesCountAndSubmit(n)}
                className={`rounded-xl py-3 text-sm font-black border-2 transition ${
                  placesCount === n ? 'border-amber-600 bg-amber-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-800'
                } ${submitPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="fixed bottom-4 inset-x-4 z-50 pointer-events-none">
          <div className="pointer-events-auto">
            {submitState.error && (
              <div className="mb-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-center text-sm font-black text-rose-700 shadow-sm animate-in fade-in">
                  {submitState.error}
              </div>
            )}
            {submitPending && (
              <div className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 py-4 text-white font-black text-center shadow-2xl animate-pulse border-b-4 border-emerald-900">
                ⏳ جارٍ إرسال الطلب النهائي للنظام...
              </div>
            )}
          </div>
      </div>



      {showUnavailableModal && (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b bg-amber-50 flex items-center justify-between">
              <h3 className="font-black text-amber-900">إبلاغ عن مواد غير متوفرة ⚠️</h3>
              <button onClick={() => setShowUnavailableModal(false)} className="text-slate-400 font-bold p-2">✕</button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <p className="text-[10px] font-bold text-slate-500">اختر المواد غير المتوفرة واكتب البديل إن وجد:</p>
              {products.map((p, i) => {
                const isSelected = unavailableSelection[i] !== undefined;
                return (
                  <div key={i} className={`p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-white'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUnavailableItem(i)}
                        className="size-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className={`text-xs font-black ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>{p.line}</span>
                    </div>
                    {isSelected && (
                      <input
                        type="text"
                        value={unavailableSelection[i]}
                        onChange={(e) => updateSubstitute(i, e.target.value)}
                        placeholder="اكتب البديل المقترح..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 focus:border-amber-500 outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t bg-slate-50 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowUnavailableModal(false)}
                className="py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={Object.keys(unavailableSelection).length === 0 || reportPending}
                onClick={handleSendUnavailable}
                className="py-3 rounded-2xl bg-amber-600 text-white font-black text-sm shadow-lg shadow-amber-200 active:scale-95 disabled:opacity-50 transition-all"
              >
                {reportPending ? "جاري الإرسال..." : "إرسال للإدارة 🚀"}
              </button>
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
