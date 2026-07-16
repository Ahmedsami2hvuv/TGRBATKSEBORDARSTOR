"use client";
// v4-bulletproof-fix: ضمان الحفظ الفوري ومنع التضارب + الخروج التلقائي عند النجاح + دعم الملكية للمجهز

import { useActionState, useMemo, useRef, useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitPreparerShoppingDraft, updatePreparerShoppingDraft, reportUnavailableProductsAction, type PreparerActionState } from "@/app/preparer/actions";
import { suggestFixedPrices } from "@/lib/fixed-prices";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { calculateAutoSellPrice, isMeatProduct } from "@/lib/auto-pricing";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { resolvePublicAssetSrc } from "@/lib/image-url";

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
  productId?: string | null;
  isFromStore?: boolean;
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
      productId: typeof r.productId === "string" ? r.productId : (typeof r.id === "string" ? r.id : null),
      isFromStore: !!r.isFromStore,
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
  const [customDeliveryAlf, setCustomDeliveryAlf] = useState<string>(() => {
    const d = initialDraft.data as any;
    return (d && d.customDeliveryAlf != null) ? String(d.customDeliveryAlf) : "";
  });
  const [noProfit, setNoProfit] = useState(!!(initialDraft.data as any)?.noProfit);
  const [products, setProducts] = useState<ProductRow[]>(() => parseProducts(initialDraft.data));

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

  // --- منع السحب للأسفل لإعادة تحميل الصفحة (pull-to-refresh) ---
  useEffect(() => {
    let touchStartClientY = 0;
    const preventPullToRefresh = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const clientY = touch.clientY;
      if (window.scrollY === 0 && clientY > touchStartClientY) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartClientY = e.touches[0].clientY;
      }
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", preventPullToRefresh, { passive: false });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", preventPullToRefresh);
    };
  }, []);

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
    const total = products.length;
    const priced = products.filter(p => p.buyAlf !== "" && p.sellAlf !== "").length;
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
  }, [products, productBranchMap, searchTerm, activeBranch]);

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
    let sell = lines[1] ? parseFloat(lines[1]) : calculateAutoSellPrice(products[selectedPriceIndex]!.line, buy, noProfit);

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

    if (goToNext) {
        // البحث عن المادة التالية غير المسعرة بناءً على الترتيب الظاهر (البصري)
        const currentVisualIdx = orderedForButtons.findIndex(item => item.idx === selectedPriceIndex);
        const nextVisualItem = orderedForButtons.slice(currentVisualIdx + 1).find(item => item.p.buyAlf === "" || item.p.sellAlf === "");

        if (nextVisualItem) {
            setSelectedPriceIndex(nextVisualItem.idx);
            setPricingLinesText("");
        } else {
            setSelectedPriceIndex(null);
            setPricingLinesText("");
        }
    } else {
        setSelectedPriceIndex(null);
        setPricingLinesText("");
    }
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
    <div className="space-y-4" dir="rtl">
      <section className="kse-glass-dark flex items-center justify-between rounded-2xl border border-violet-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href={preparerPath("/preparer/preparation", auth)}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            ✕ إغلاق
          </Link>
          <h1 className="text-base font-black text-violet-950">تجهيز مشترك: {initialDraft.customerRegion?.name}</h1>
        </div>
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
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 mr-2">العنوان والمنطقة</span>
              <input value={titleLine} onChange={(e) => { setTitleLine(e.target.value); isDirtyRef.current = true; }} className={inputClass} placeholder="العنوان" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 mr-2">وقت التجهيز</span>
              <input value={orderTime} onChange={(e) => { setOrderTime(e.target.value); isDirtyRef.current = true; }} className={inputClass} placeholder="الوقت" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 mr-2">سعر التوصيل المخصص (اختياري)</span>
              <input
                value={customDeliveryAlf}
                onChange={(e) => {
                    setCustomDeliveryAlf(e.target.value);
                    isDirtyRef.current = true;
                }}
                className={`${inputClass} font-mono`}
                placeholder="اتركه فارغاً لاستخدام سعر المنطقة..."
                inputMode="decimal"
              />
            </div>
          </div>
        )}

      <section className="kse-glass-dark rounded-2xl border border-indigo-200 p-4 shadow-sm relative">
        {/* شريط الأدوات المثبت */}
        <div className="sticky top-0 z-20 bg-inherit pb-2 space-y-3 -mx-4 px-4 border-b border-indigo-50 mb-4 pt-1">
            {/* مؤشر الإنجاز */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-slate-500">مستوى الإنجاز</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${stats.percent === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {stats.priced} من {stats.total} ({stats.percent}%)
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    stats.percent < 40 ? 'bg-rose-500' : stats.percent < 80 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>

            {/* شريط البحث */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث عن مادة..."
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pr-8 pl-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 bg-slate-200 text-slate-500 rounded-full text-[8px] flex items-center justify-center"
                    >✕</button>
                  )}
                </div>
            </div>

            {/* فلاتر الفروع */}
            {branches.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                    <button
                        onClick={() => setActiveBranch(null)}
                        className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black transition-all ${!activeBranch ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
                    > الكل </button>
                    {branches.map(b => (
                        <button
                            key={b}
                            onClick={() => setActiveBranch(b === activeBranch ? null : b)}
                            className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black transition-all ${activeBranch === b ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
                        >
                            {b}
                        </button>
                    ))}
                </div>
            )}
        </div>

        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-indigo-950 text-nowrap">قائمة المنتجات</h2>
                <button
                  type="button"
                  onClick={() => handleToggleNoProfit(!noProfit)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                    noProfit
                      ? "bg-rose-600 text-white animate-pulse"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  }`}
                >
                  {noProfit ? "🚫 إيقاف الربح مفعل" : "🚫 إيقاف الربح"}
                </button>
            </div>
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
                <button
                  type="button"
                  disabled={isSorting}
                  onClick={handleAiSort}
                  className="rounded-lg bg-indigo-600 text-white px-2 py-1 text-[10px] font-bold disabled:opacity-50"
                >
                  {isSorting ? "جاري..." : "ترتيب 🪄"}
                </button>
                <button type="button" onClick={() => { setShowAddProductsPanel(!showAddProductsPanel); setDeleteMode(false); }} className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-[10px] font-bold">+ مادة</button>
                <button type="button" onClick={() => setShowUnavailableModal(true)} className="rounded-lg bg-amber-500 text-white px-2 py-1 text-[10px] font-bold">غير متوفر</button>
                <button type="button" onClick={() => { setDeleteMode(!deleteMode); setShowAddProductsPanel(false); }} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${deleteMode ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>حذف</button>
            </div>
        </div>

        {sortError && <p className="mb-3 text-center text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg dark:bg-rose-950/20 dark:text-rose-400">{sortError}</p>}
        {showAddProductsPanel && (
            <div className="mb-3 p-3 bg-white rounded-xl border-2 border-emerald-200 shadow-inner">
                <textarea value={addProductsText} onChange={(e) => setAddProductsText(e.target.value)} rows={3} className={inputClass} placeholder="اكتب المواد الجديدة هنا..." />
                <button type="button" onClick={addProductsFromText} className="mt-2 w-full bg-emerald-600 text-white rounded-lg py-2 text-xs font-black">إضافة للمجموعة</button>
            </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
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
                  setPricingLinesText(priced ? `${p.buyAlf}` : "");
                }}
                className={`w-full relative flex items-center gap-2 rounded-xl border-2 p-2 text-start transition min-h-[64px] ${
                  active ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" :
                  isOthers ? "border-slate-300 bg-slate-100 opacity-40 grayscale cursor-not-allowed" :
                  priced ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-200 bg-white shadow-sm"
                } ${isMeat && priced ? "opacity-90 cursor-default" : ""}`}
              >
                {/* صورة المنتج */}
                {productImagesMap[p.line.trim().toLowerCase()] && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomImage({
                        url: productImagesMap[p.line.trim().toLowerCase()],
                        title: p.line
                      });
                    }}
                    className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-slate-100 bg-white/10 active:scale-90 transition-transform cursor-zoom-in"
                  >
                    <img
                      src={resolvePublicAssetSrc(productImagesMap[p.line.trim().toLowerCase()])!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 h-full">
                    <p className={`text-[10px] font-black leading-tight line-clamp-2 pr-1 flex items-center gap-1 ${priced && !isOthers ? "text-white" : "text-slate-800"}`}>
                      {priced && <span className="shrink-0">✅</span>}
                      <span>
                        {p.line}
                        {p.qty && p.qty > 0 && (
                          <span className={`font-black px-1.5 py-0.5 rounded mr-1 text-[9px] inline-block ${
                            priced && !isOthers 
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40" 
                              : "bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                          }`}>
                            x{p.qty}
                          </span>
                        )}
                      </span>
                    </p>

                    <div className="flex items-center justify-between gap-1 mt-1">
                        <div className="flex flex-wrap items-center gap-1 min-w-0">
                            {productBranchMap[p.line.trim().toLowerCase()] && (
                              <p className={`text-[7px] font-black px-1 py-0.5 rounded whitespace-nowrap ${priced && !isOthers ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                📍 {productBranchMap[p.line.trim().toLowerCase()]}
                              </p>
                            )}

                            {isAssignedToOther ? (
                              <p className="text-[7px] font-bold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40">
                                ⚠️ {p.assignedPreparerName || "مجهز آخر"}
                              </p>
                            ) : p.assignedPreparerId === preparerId ? (
                              <p className="text-[7px] font-bold text-emerald-300">لك</p>
                            ) : priced ? (
                              <p className={`text-[7px] font-bold ${isOthers ? "text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400" : "text-emerald-300"}`}>
                                {isPricedByOther ? `⚠️ ${p.pricedBy || "مجهز آخر"}` : (p.pricedById === "auto" ? "تلقائي" : "أنت")}
                              </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* شارة السعر - مطلقة لتوفير المساحة الرأسية */}
                <div className="absolute top-1 left-1">
                    {isMeat ? (
                        priced ? (
                            <span className="text-[7px] font-bold text-emerald-400 bg-emerald-950/50 px-1 py-0.5 rounded shadow-sm border border-emerald-800/20">تلقائي</span>
                        ) : (
                            <span className="text-[7px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 shadow-sm">تسعير</span>
                        )
                    ) : priced ? (
                        <span className={`font-mono text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm ${isOthers ? "bg-slate-200 text-slate-500" : "bg-emerald-500 text-white"}`}>{p.buyAlf}</span>
                    ) : (
                        null
                    )}
                </div>
              </button>
            );
          })}
        </div>

        {selectedPriceIndex !== null && (
            <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 overflow-y-auto max-h-[95vh]">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">واجهة التسعير الذكي</p>
                            <h3 className="text-sm font-black text-slate-900 leading-tight">{products[selectedPriceIndex]?.line}</h3>
                        </div>
                        <button onClick={() => setSelectedPriceIndex(null)} className="size-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400">✕</button>
                    </div>

                    {pricingErr && <p className="text-[10px] text-rose-600 font-bold mb-3 p-2 bg-rose-50 rounded-lg border border-rose-100">⚠️ {pricingErr}</p>}

                    {/* اقتراحات الأسعار */}
                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-slate-400 mb-2">اقتراحات سابقة أو شائعة:</p>
                        <div className="flex flex-wrap gap-2">
                          {(priceHistory[products[selectedPriceIndex]!.line] || [
                            { buyAlf: 0.5 }, { buyAlf: 0.75 }, { buyAlf: 1 }, { buyAlf: 1.25 }, { buyAlf: 1.5 }, { buyAlf: 2 }, { buyAlf: 3 }, { buyAlf: 5 }
                          ]).map((h, hi) => (
                            <button
                              key={hi}
                              type="button"
                              onPointerDown={(e) => e.preventDefault()} // منع إغلاق الكيبورد
                              onClick={() => {
                                setPricingLinesText(String(h.buyAlf));
                                const buy = h.buyAlf;
                                const sell = calculateAutoSellPrice(products[selectedPriceIndex!]!.line, buy, noProfit);
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
                                  // الانتقال للتالي تلقائياً عند اختيار مقترح
                                  const currentVisualIdx = orderedForButtons.findIndex(item => item.idx === selectedPriceIndex);
                                  const nextVisualItem = orderedForButtons.slice(currentVisualIdx + 1).find(item => item.p.buyAlf === "" || item.p.sellAlf === "");
                                  if (nextVisualItem) {
                                      setSelectedPriceIndex(nextVisualItem.idx);
                                      setPricingLinesText("");
                                      pricingTextareaRef.current?.focus(); // فوكس فوري
                                  } else {
                                      setSelectedPriceIndex(null);
                                      setPricingLinesText("");
                                  }
                                }
                              }}
                              className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-black active:bg-amber-600 active:text-white transition-all"
                            >
                              {h.buyAlf}
                            </button>
                          ))}
                        </div>
                    </div>

                    {/* اقتراحات الكسور الذكية */}
                    <div className="mb-6">
                      {(() => {
                        const typedValue = parseFloat(pricingLinesText);
                        if (isNaN(typedValue) || typedValue <= 0) return (
                            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                                <p className="text-[10px] font-bold text-slate-400">اكتب الرقم الأول ليظهر لك شريط الكسور هنا...</p>
                            </div>
                        );

                        const base = Math.floor(typedValue);
                        const fractions = [0, 0.25, 0.5, 0.75];

                        return (
                          <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-200 animate-in slide-in-from-top-2 duration-300 shadow-inner">
                            <div className="flex items-center justify-between mb-3 px-1">
                              <p className="text-[10px] font-black text-indigo-900">إكمال السعر لـ ({base}) :</p>
                              <span className="text-[9px] font-bold text-indigo-400 animate-pulse">توفير وقت! انقر للكسر</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {fractions.map(frac => {
                                const total = base + frac;
                                const isCurrent = total === typedValue;

                                return (
                                  <button
                                    key={frac}
                                    type="button"
                                    onPointerDown={(e) => e.preventDefault()} // يمنع فقدان الفوكس والكيبورد
                                    onClick={() => {
                                      const buy = total;
                                      const sell = calculateAutoSellPrice(products[selectedPriceIndex!]!.line, buy, noProfit);
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

                                        const currentVisualIdx = orderedForButtons.findIndex(item => item.idx === selectedPriceIndex);
                                        const nextVisualItem = orderedForButtons.slice(currentVisualIdx + 1).find(item => item.p.buyAlf === "" || item.p.sellAlf === "");
                                        if (nextVisualItem) {
                                            setSelectedPriceIndex(nextVisualItem.idx);
                                            setPricingLinesText("");
                                            pricingTextareaRef.current?.focus(); // فوكس فوري للمادة التالية
                                        } else {
                                            setSelectedPriceIndex(null);
                                            setPricingLinesText("");
                                        }
                                      }
                                    }}
                                    className={`py-5 rounded-2xl text-base font-black shadow-md active:scale-95 transition-all flex flex-col items-center justify-center ${
                                      isCurrent ? "bg-indigo-400 text-white" : "bg-indigo-600 text-white"
                                    }`}
                                  >
                                    <span>{total}</span>
                                    {frac > 0 && <span className="text-[10px] opacity-80">+{frac}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="relative mb-6">
                        <textarea
                          ref={pricingTextareaRef}
                          value={pricingLinesText}
                          onChange={(e) => setPricingLinesText(e.target.value)}
                          className={`${inputClass} text-center font-black text-2xl h-16 pt-3 border-2 border-indigo-100 focus:border-indigo-500`}
                          placeholder="0.00"
                          inputMode="decimal"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPricingPanel(true); } }}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ألف د.ع</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <button
                            type="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => {
                                applyPricingPanel(true);
                                pricingTextareaRef.current?.focus();
                            }}
                            className="bg-emerald-600 text-white rounded-2xl py-4 text-sm font-black shadow-xl shadow-emerald-100 active:scale-95 transition-all"
                        >
                            حفظ والتالي ⬅️
                        </button>
                        <button type="button" onClick={() => applyPricingPanel(false)} className="bg-indigo-600 text-white rounded-2xl py-4 text-sm font-black">حفظ وإغلاق</button>
                    </div>

                    <div className="flex flex-col gap-2">
                        {products[selectedPriceIndex]?.buyAlf !== "" && (
                          <button
                            type="button"
                            onClick={unpriceProduct}
                            className="w-full bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl py-3 text-xs font-black active:bg-rose-600 active:text-white transition-all"
                          >
                            🗑️ مسح السعر الحالي
                          </button>
                        )}
                        <button type="button" onClick={() => setSelectedPriceIndex(null)} className="w-full bg-slate-50 text-slate-500 rounded-2xl py-3 text-xs font-bold">إلغاء وتراجع</button>
                    </div>
                </div>
            </div>
        )}
      </section>

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
