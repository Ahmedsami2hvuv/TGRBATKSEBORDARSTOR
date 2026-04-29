"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { openUrlFromUserGesture, telHref, whatsappMeUrl } from "@/lib/whatsapp";
import {
  MANDOUB_FAB_EVT_OPEN_SCALE_PANEL,
  MANDOUB_FAB_EVT_RESET_LAYOUT,
  MANDOUB_FAB_EVT_SCALE,
} from "@/lib/mandoub-fab-bridge";
import { PREPARER_ORDER_EDIT_PANEL_EVT } from "@/lib/preparer-edit-panel-events";

/** حجم الزر العائم — القياس الأساسي قبل مضاعفة المستخدم (واتساب / اتصال / قوالب / دفع عميل / استلام) */
export const FAB_SIZE = 52;
const FAB_GAP = 10;
const DRAG_THRESHOLD = 10;
const LONG_PRESS_MS = 650;
/** حدود تكبير/تصغير الأزرار (شريط التمرير بعد لمس مطوّل) */
export const FAB_SCALE_MIN = 0.55;
export const FAB_SCALE_MAX = 1.85;

export type Pos = { left: number; top: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * يقرأ مواضع الأزرار العائمة — تنسيق واحد لكل `storageKey` (نفس المكان في كل الطلبات).
 * يدعم التنسيق القديم: كائن متداخل { [orderId]: { wa, tel, ... } } ويأخذ أول خريطة مواضع صالحة.
 */
function readGlobalFabLayout(storageKey: string): Record<string, Pos> | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;

    const looksLikePosMap = (o: unknown): o is Record<string, Pos> => {
      if (!o || typeof o !== "object") return false;
      const m = o as Record<string, unknown>;
      const first = m.wa ?? m.tel ?? Object.values(m)[0];
      return (
        first !== null &&
        typeof first === "object" &&
        typeof (first as Pos).left === "number" &&
        typeof (first as Pos).top === "number"
      );
    };

    if (looksLikePosMap(parsed)) {
      return migrateLegacyPositions(parsed as Record<string, Pos>);
    }

    for (const v of Object.values(p)) {
      if (looksLikePosMap(v)) {
        return migrateLegacyPositions(v as Record<string, Pos>);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function saveGlobalFabLayout(storageKey: string, positions: Record<string, Pos>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(positions));
  } catch {
    /* ignore */
  }
}

export function fabScaleStorageKey(storageKey: string): string {
  return `${storageKey}_fabScale`;
}

export function loadFabScale(storageKey: string): number {
  try {
    const raw = localStorage.getItem(fabScaleStorageKey(storageKey));
    if (!raw) return 1;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 1;
    return clamp(n, FAB_SCALE_MIN, FAB_SCALE_MAX);
  } catch {
    return 1;
  }
}

export function saveFabScale(storageKey: string, scale: number) {
  try {
    localStorage.setItem(fabScaleStorageKey(storageKey), String(scale));
  } catch {
    /* ignore */
  }
}

function dispatchMandoubFabScale(storageKey: string, scale: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MANDOUB_FAB_EVT_SCALE, { detail: { storageKey, scale } }),
  );
}

function defaultPositionsFor(fabIds: string[]): Record<string, Pos> {
  if (typeof window === "undefined") return {};
  const w = window.innerWidth;
  const h = window.innerHeight;
  const margin = 12;
  const out: Record<string, Pos> = {};
  fabIds.forEach((id, i) => {
    out[id] = {
      left: w - margin - FAB_SIZE - 4,
      top: h - margin - FAB_SIZE - i * (FAB_SIZE + FAB_GAP) - 80,
    };
  });
  return out;
}

function migrateLegacyPositions(saved: Record<string, Pos>): Record<string, Pos> {
  const m: Record<string, Pos> = { ...saved };
  /** وضع حالي: زرّا wa و tel فقط — ندمج المواضع القديمة */
  if (!m.wa) {
    if (m.wa_shop) m.wa = { ...m.wa_shop };
    else if (m.wa_cust) m.wa = { ...m.wa_cust };
  }
  if (!m.tel) {
    if (m.tel_shop) m.tel = { ...m.tel_shop };
    else if (m.tel_cust) m.tel = { ...m.tel_cust };
  }
  return m;
}

export function IconWa({
  className = "h-[22px] w-[22px]",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function IconPhone({
  className = "h-[22px] w-[22px]",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}

type DraggableFabProps = {
  fabId: string;
  position: Pos;
  fabSize: number;
  onPositionMove: (id: string, pos: Pos) => void;
  onDragEndPersist: (id: string, pos: Pos) => void;
  zIndex: number;
  title: string;
  className: string;
  children: React.ReactNode;
  onTap?: () => void;
  /** لمس مطوّل دون سحب — مثلاً فتح لوحة تكبير الأزرار */
  onLongPress?: () => void;
};

function DraggableFab({
  fabId,
  position,
  fabSize,
  onPositionMove,
  onDragEndPersist,
  zIndex,
  title,
  className,
  children,
  onTap,
  onLongPress,
}: DraggableFabProps) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
    lastPos: Pos;
  } | null>(null);
  const blockClickRef = useRef(false);
  /** يمنع نقرة/لمس اصطناعي بعد pointerup (شائع على الجوال) يعيد ضرب الفاب فيغلق القائمة فوراً */
  const suppressSyntheticClickUntilRef = useRef(0);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const clearLongPress = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const onPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    longPressFiredRef.current = false;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: position.left,
      origTop: position.top,
      moved: false,
      lastPos: { ...position },
    };
    blockClickRef.current = false;
    clearLongPress();
    if (onLongPress) {
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        if (!dragRef.current?.moved) {
          longPressFiredRef.current = true;
          onLongPress();
        }
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      d.moved = true;
      blockClickRef.current = true;
      clearLongPress();
    }
    if (!d.moved) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const next = {
      left: clamp(d.origLeft + dx, 0, w - fabSize),
      top: clamp(d.origTop + dy, 0, h - fabSize),
    };
    d.lastPos = next;
    onPositionMove(fabId, next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    const d = dragRef.current;
    const skipTap = longPressFiredRef.current;
    longPressFiredRef.current = false;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d?.moved) {
      onDragEndPersist(fabId, d.lastPos);
      window.setTimeout(() => {
        blockClickRef.current = false;
      }, 0);
    } else if (onTap && !d?.moved && !skipTap) {
      suppressSyntheticClickUntilRef.current = Date.now() + 380;
      onTap();
    }
  };

  const swallowClickIfDragged = (e: React.MouseEvent) => {
    if (blockClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (Date.now() < suppressSyntheticClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className="pointer-events-auto touch-none select-none"
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        width: fabSize,
        height: fabSize,
        zIndex,
        touchAction: "none",
      }}
      title={title}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={`flex h-full w-full cursor-grab items-center justify-center rounded-full shadow-lg ring-2 ring-white/40 active:cursor-grabbing ${className}`}
        onClickCapture={swallowClickIfDragged}
      >
        {children}
      </div>
    </div>
  );
}

export type OrderFabDockProps = {
  storageKey: string;
  /** إن وُجد ولم تُوجد مواضع للمفتاح الحالي، يُحمَّل منه (ترحيل من إصدارات التخزين السابقة). */
  legacyLayoutStorageKey?: string;
  orderId: string;
  shopPhone: string;
  /** تسمية زر المحل/العميل في القائمة (مثلاً: "إدارة") */
  shopLabel?: string;
  customerPhone: string;
  customerAlternatePhone?: string;
  /** رقم مجهز الشركة — يفعّل قائمة واتساب/اتصال: محل، زبون، مجهز */
  preparerPhone?: string;
  /** رابط تعديل الطلب (للإدارة) ليصبح عائماً */
  editUrl?: string;
  customWaButtons?: Array<{
    id: string;
    label: string;
    iconKey: string;
    messages: string[];
  }>;
  /** عند واجهة المجهز: إخفاء أزرار التواصل أثناء فتح نموذج تعديل الطلب */
  hideWhenPreparerEditOpen?: boolean;
  /** إخفاء جميع أزرار الاتصال/واتساب تماماً */
  hideAllButtons?: boolean;
};

export function OrderFabDock(props: OrderFabDockProps) {
  const {
    storageKey,
    legacyLayoutStorageKey,
    orderId,
    shopPhone,
    shopLabel = "عميل",
    customerPhone,
    customerAlternatePhone,
    preparerPhone,
    editUrl,
    customWaButtons,
    hideWhenPreparerEditOpen = false,
    hideAllButtons = false,
  } = props;

  const [preparerEditOpen, setPreparerEditOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!hideWhenPreparerEditOpen) return;
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent<{ open?: boolean }>).detail;
      setPreparerEditOpen(Boolean(d?.open));
    };
    window.addEventListener(PREPARER_ORDER_EDIT_PANEL_EVT, onEvt);
    return () => window.removeEventListener(PREPARER_ORDER_EDIT_PANEL_EVT, onEvt);
  }, [hideWhenPreparerEditOpen]);

  const hideShell = hideAllButtons || (hideWhenPreparerEditOpen && preparerEditOpen);

  useEffect(() => {
    if (!hideAllButtons) return;
    setContactMenu(null);
    setCustomWaPick(null);
    setScalePanelOpen(false);
  }, [hideAllButtons]);

  const customFabIds = useMemo(
    () => (customWaButtons ?? []).map((b) => `cwa:${b.id}`),
    [customWaButtons],
  );
  const fabIds = useMemo(
    (): string[] => ["wa", "tel", ...customFabIds],
    [customFabIds],
  );

  const [contactMenu, setContactMenu] = useState<null | "wa" | "tel">(null);
  type CustomWaBtn = NonNullable<OrderFabDockProps["customWaButtons"]>[number];
  const [customWaPick, setCustomWaPick] = useState<null | { btn: CustomWaBtn }>(
    null,
  );
  const [scalePanelOpen, setScalePanelOpen] = useState(false);

  useEffect(() => {
    if (!hideShell) return;
    setContactMenu(null);
    setCustomWaPick(null);
    setScalePanelOpen(false);
  }, [hideShell]);

  /** يمنع إغلاق القائمة من نفس سلسلة اللمس التي فتحتها (الخلفية تُرسم فوق الإصبع) */
  const overlayDismissGuardUntilRef = useRef(0);
  /** تأخير طفيف لظهور الخلفية حتى لا تلتقط نقرة/لمساً اصطنافياً */
  const [contactShadeReady, setContactShadeReady] = useState(false);

  useEffect(() => {
    if (!contactMenu && !customWaPick) {
      setContactShadeReady(false);
      return;
    }
    setContactShadeReady(false);
    const t = window.setTimeout(() => setContactShadeReady(true), 48);
    return () => clearTimeout(t);
  }, [contactMenu, customWaPick]);

  useEffect(() => {
    if (!contactMenu && !customWaPick && !scalePanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContactMenu(null);
        setCustomWaPick(null);
        setScalePanelOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [contactMenu, customWaPick, scalePanelOpen]);

  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [dragZ, setDragZ] = useState(90);
  const mountedRef = useRef(false);
  const [fabScale, setFabScale] = useState(1);
  const fabScaleRef = useRef(1);

  useEffect(() => {
    fabScaleRef.current = fabScale;
  }, [fabScale]);

  useEffect(() => {
    const s = loadFabScale(storageKey);
    setFabScale(s);
    fabScaleRef.current = s;
    dispatchMandoubFabScale(storageKey, s);
  }, [storageKey]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<{ storageKey?: string }>;
      if (ce.detail?.storageKey !== storageKey) return;
      setContactMenu(null);
      setCustomWaPick(null);
      setScalePanelOpen(true);
    };
    window.addEventListener(MANDOUB_FAB_EVT_OPEN_SCALE_PANEL, onOpen);
    return () => window.removeEventListener(MANDOUB_FAB_EVT_OPEN_SCALE_PANEL, onOpen);
  }, [storageKey]);

  useEffect(() => {
    setContactMenu(null);
    setCustomWaPick(null);
  }, [orderId]);

  useEffect(() => {
    let savedFlat = readGlobalFabLayout(storageKey);
    if (!savedFlat && legacyLayoutStorageKey) {
      savedFlat = readGlobalFabLayout(legacyLayoutStorageKey);
    }
    const saved = savedFlat ? migrateLegacyPositions(savedFlat) : {};
    const defaults = defaultPositionsFor(fabIds);
    const merged: Record<string, Pos> = {};
    fabIds.forEach((id) => {
      merged[id] = saved[id] ?? defaults[id] ?? { left: 16, top: 120 };
    });
    setPositions(merged);
    mountedRef.current = true;
  }, [fabIds.join(","), storageKey, legacyLayoutStorageKey]);

  const fabSize = FAB_SIZE * fabScale;
  const iconPx = Math.max(14, Math.round((22 / FAB_SIZE) * fabSize));
  const resetFabScale = useCallback(() => {
    fabScaleRef.current = 1;
    setFabScale(1);
    saveFabScale(storageKey, 1);
    dispatchMandoubFabScale(storageKey, 1);
  }, [storageKey]);

  const applyFabScale = useCallback(
    (next: number) => {
      const n = clamp(next, FAB_SCALE_MIN, FAB_SCALE_MAX);
      fabScaleRef.current = n;
      setFabScale(n);
      saveFabScale(storageKey, n);
      dispatchMandoubFabScale(storageKey, n);
    },
    [storageKey],
  );

  /** يعيد مواضع كل الأزرار العائمة كما عند أول فتح للصفحة (يمين الشاشة، عمودياً). */
  const resetPositionsToDefaults = useCallback(() => {
    const defaults = defaultPositionsFor(fabIds);
    setPositions(defaults);
    if (mountedRef.current) saveGlobalFabLayout(storageKey, defaults);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(MANDOUB_FAB_EVT_RESET_LAYOUT, { detail: { storageKey } }),
      );
    }
  }, [fabIds, storageKey]);

  const openScalePanel = useCallback(() => {
    setContactMenu(null);
    setCustomWaPick(null);
    setScalePanelOpen(true);
  }, []);

  const dismissContactOverlay = useCallback(() => {
    if (Date.now() < overlayDismissGuardUntilRef.current) return;
    setContactMenu(null);
    setCustomWaPick(null);
    setIsExpanded(false);
  }, []);

  const movePosition = useCallback((id: string, pos: Pos) => {
    setPositions((prev) => ({ ...prev, [id]: pos }));
  }, []);

  const persistPosition = useCallback(
    (id: string, pos: Pos) => {
      setDragZ((z) => z + 1);
      setPositions((prev) => {
        const next = { ...prev, [id]: pos };
        if (mountedRef.current) saveGlobalFabLayout(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const waShop = whatsappMeUrl(shopPhone);
  const waCust = whatsappMeUrl(customerPhone);
  const waCust2 = customerAlternatePhone?.trim()
    ? whatsappMeUrl(customerAlternatePhone)
    : "#";
  const waPrep = preparerPhone?.trim() ? whatsappMeUrl(preparerPhone.trim()) : "#";
  const telShop = telHref(shopPhone);
  const telCust = telHref(customerPhone);
  const telCust2 = customerAlternatePhone?.trim() ? telHref(customerAlternatePhone) : "#";
  const telPrep = preparerPhone?.trim() ? telHref(preparerPhone.trim()) : "#";

  const hasCust2 = customerAlternatePhone?.trim().length;
  /** طلب مرفوع من مجهز شركة: قائمة واتساب/اتصال ثلاثية (محل، زبون، مجهز) */
  const usePreparerTriple = Boolean(preparerPhone?.trim());

  const openWa = (target: "shop" | "customer" | "customer2" | "preparer") => {
    const url =
      target === "shop"
        ? waShop
        : target === "customer"
          ? waCust
          : target === "preparer"
            ? waPrep
            : waCust2;
    if (url !== "#") openUrlFromUserGesture(url);
    setContactMenu(null);
    setCustomWaPick(null);
  };

  const openCustomWaToTarget = (
    btn: CustomWaBtn,
    target: "shop" | "customer" | "customer2",
  ) => {
    const pool = btn.messages.filter((m) => m.trim().length > 0);
    const picked =
      pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : "";
    const phone =
      target === "shop"
        ? shopPhone
        : target === "customer"
          ? customerPhone
          : customerAlternatePhone ?? "";
    const url = whatsappMeUrl(phone, picked);
    if (url !== "#") openUrlFromUserGesture(url);
    setCustomWaPick(null);
  };

  const openTel = (target: "shop" | "customer" | "customer2" | "preparer") => {
    const href =
      target === "shop"
        ? telShop
        : target === "customer"
          ? telCust
          : target === "preparer"
            ? telPrep
            : telCust2;
    if (href !== "#") openUrlFromUserGesture(href);
    setContactMenu(null);
    setCustomWaPick(null);
  };

  const contactMenuPos = contactMenu === "wa" ? positions.wa : contactMenu === "tel" ? positions.tel : null;
  /** ارتفاع تقريبي لقائمة واتساب/اتصال */
  const MENU_H = usePreparerTriple ? 148 : hasCust2 ? 148 : 96;
  const showMenuAbove =
    contactMenuPos != null && contactMenuPos.top > MENU_H + fabSize + 16;
  const menuTop = contactMenuPos
    ? showMenuAbove
      ? contactMenuPos.top - MENU_H - 8
      : contactMenuPos.top + fabSize + 8
    : 0;
  const menuLeft = contactMenuPos ? Math.max(8, contactMenuPos.left - 36) : 0;

  /** أعلى من زرّ الفاب حتى لا تُغطّي الأزرار القائمة بعد سحبات متكرّرة (كان dragZ يتجاوز z القائمة) */
  const fabZ = Math.min(dragZ, 99);

  /** قائمة عميل / زبون / زبون2 لقوالب الواتساب المخصصة */
  const CUSTOM_PICK_H = hasCust2 ? 248 : 208;
  const customPickFabId = customWaPick ? `cwa:${customWaPick.btn.id}` : null;
  const customPickPos = customPickFabId ? positions[customPickFabId] : null;
  const showCustomPickAbove =
    customPickPos != null && customPickPos.top > CUSTOM_PICK_H + fabSize + 16;
  const customPickMenuTop = customPickPos
    ? showCustomPickAbove
      ? customPickPos.top - CUSTOM_PICK_H - 8
      : customPickPos.top + fabSize + 8
    : 0;
  const customPickMenuLeft = customPickPos ? Math.max(8, customPickPos.left - 58) : 0;

  /** فوق أزرار الأموال العائمة (z≈1200–1210 في `mandoub-order-money-float-dock`) وتحت نافذة التأكيد (z≈1300). */
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[1240] ${hideShell ? "hidden" : ""}`}
      style={{ paddingInlineStart: "max(0px, env(safe-area-inset-left))" }}
    >
      {contactMenu || customWaPick || isExpanded ? (
        contactShadeReady ? (
          <button
            type="button"
            className="pointer-events-auto fixed inset-0 z-[999] cursor-default touch-manipulation bg-black/20 backdrop-blur-[1px]"
            aria-label="إغلاق القائمة"
            onClick={dismissContactOverlay}
          />
        ) : null
      ) : null}

      {scalePanelOpen ? (
        <>
          <button
            type="button"
            className="pointer-events-auto fixed inset-0 z-[10050] cursor-default bg-black/40 backdrop-blur-[2px] md:bg-black/35"
            aria-label="إغلاق لوحة التكبير"
            onClick={() => setScalePanelOpen(false)}
          />
          <div
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-[10051] max-h-[min(90vh,28rem)] overflow-y-auto border-t border-sky-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_40px_rgba(15,23,42,0.18)] sm:px-6 sm:pt-5 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[min(85vh,32rem)] md:w-[min(100vw-2rem,26rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-sky-200 md:shadow-2xl"
            dir="rtl"
            role="dialog"
            aria-label="تكبير الأزرار العائمة"
            aria-modal="true"
          >
            <p className="mb-1 text-center text-sm font-bold text-slate-800 sm:text-base">
              حجم الأزرار العائمة (واتساب، اتصال، قوالب، دفع عميل، استلام)
            </p>
            <p className="mb-3 text-center text-xs font-semibold text-sky-700 md:text-sm">
              السحب بالفأرة على الشريط — القيمة الحالية:{" "}
              <span className="tabular-nums font-black">{fabScale.toFixed(2)}</span>
            </p>
            <div className="flex flex-col gap-4 md:gap-5">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-bold text-slate-600 md:text-sm">
                  اسحب الشريط للتكبير أو التصغير (يمكن أيضاً النقر على المسار)
                </span>
                <input
                  type="range"
                  min={FAB_SCALE_MIN}
                  max={FAB_SCALE_MAX}
                  step={0.01}
                  value={fabScale}
                  onChange={(e) => applyFabScale(Number(e.target.value))}
                  onInput={(e) => applyFabScale(Number((e.target as HTMLInputElement).value))}
                  className="fab-scale-range h-14 w-full min-w-0 cursor-pointer accent-sky-600 md:h-16"
                />
              </label>
              <div className="flex w-full min-w-0 flex-col flex-wrap justify-stretch gap-2 sm:flex-row sm:items-stretch sm:justify-center">
                <button
                  type="button"
                  onClick={resetFabScale}
                  title="إعادة حجم الأزرار إلى الافتراضي"
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl border-2 border-amber-400 bg-amber-50 px-3 text-sm font-black text-amber-950 shadow-sm hover:bg-amber-100 sm:min-w-[5rem] sm:flex-none"
                >
                  إعادة
                </button>
                <button
                  type="button"
                  onClick={resetPositionsToDefaults}
                  title="إرجاع أماكن الأزرار إلى الزاوية اليمنى السفلى كما في البداية"
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-3 text-xs font-black leading-snug text-emerald-950 shadow-sm hover:bg-emerald-100 sm:max-w-[11rem] sm:flex-1 sm:text-sm"
                >
                  إعادة ترتيب الأماكن
                </button>
                <button
                  type="button"
                  onClick={() => setScalePanelOpen(false)}
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl border-2 border-sky-500 bg-sky-600 px-3 text-sm font-black text-white shadow-sm hover:bg-sky-700 sm:min-w-[5rem] sm:flex-none"
                >
                  رجوع
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {contactMenu && contactMenuPos ? (
        <div
          className="pointer-events-auto fixed z-[1000] flex w-[124px] touch-manipulation flex-col gap-1 rounded-2xl border border-sky-200/90 bg-white p-2 shadow-xl"
          style={{ left: menuLeft, top: menuTop }}
          dir="rtl"
          role="menu"
          aria-label={
            contactMenu === "wa"
              ? usePreparerTriple
                ? "واتساب — محل، زبون، مجهز"
                : `واتساب — ${shopLabel}، زبون، زبون2`
              : usePreparerTriple
                ? "اتصال — محل، زبون، مجهز"
                : `اتصال — ${shopLabel}، زبون، زبون2`
          }
        >
          {usePreparerTriple ? (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={contactMenu === "wa" ? waShop === "#" : telShop === "#"}
                className={`min-h-[40px] touch-manipulation rounded-xl px-3 py-2 text-sm font-bold transition ${
                  contactMenu === "wa"
                    ? waShop === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                    : telShop === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-sky-600 text-white hover:bg-sky-700"
                }`}
                onClick={() =>
                  contactMenu === "wa" ? openWa("shop") : openTel("shop")
                }
              >
                محل
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={contactMenu === "wa" ? waCust === "#" : telCust === "#"}
                className={`min-h-[40px] touch-manipulation rounded-xl px-3 py-2 text-sm font-bold transition ${
                  contactMenu === "wa"
                    ? waCust === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-teal-600 text-white hover:bg-teal-700"
                    : telCust === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
                onClick={() =>
                  contactMenu === "wa" ? openWa("customer") : openTel("customer")
                }
              >
                زبون
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={contactMenu === "wa" ? waPrep === "#" : telPrep === "#"}
                className={`min-h-[40px] touch-manipulation rounded-xl px-3 py-2 text-sm font-bold transition ${
                  contactMenu === "wa"
                    ? waPrep === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-violet-600 text-white hover:bg-violet-700"
                    : telPrep === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-violet-800 text-white hover:bg-violet-900"
                }`}
                onClick={() =>
                  contactMenu === "wa" ? openWa("preparer") : openTel("preparer")
                }
              >
                مجهز
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={contactMenu === "wa" ? waShop === "#" : telShop === "#"}
                className={`min-h-[40px] touch-manipulation rounded-xl px-3 py-2 text-sm font-bold transition ${
                  contactMenu === "wa"
                    ? waShop === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                    : telShop === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-sky-600 text-white hover:bg-sky-700"
                }`}
                onClick={() =>
                  contactMenu === "wa" ? openWa("shop") : openTel("shop")
                }
              >
                {shopLabel}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={contactMenu === "wa" ? waCust === "#" : telCust === "#"}
                className={`min-h-[40px] touch-manipulation rounded-xl px-3 py-2 text-sm font-bold transition ${
                  contactMenu === "wa"
                    ? waCust === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-teal-600 text-white hover:bg-teal-700"
                    : telCust === "#"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
                onClick={() =>
                  contactMenu === "wa" ? openWa("customer") : openTel("customer")
                }
              >
                زبون
              </button>
              {hasCust2 ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={contactMenu === "wa" ? waCust2 === "#" : telCust2 === "#"}
                  className={`min-h-[40px] touch-manipulation rounded-xl px-3 py-2 text-sm font-bold transition ${
                    contactMenu === "wa"
                      ? waCust2 === "#"
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-emerald-500/90 text-white hover:bg-emerald-50"
                      : telCust2 === "#"
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-indigo-700 text-white hover:bg-indigo-800"
                  }`}
                  onClick={() =>
                    contactMenu === "wa" ? openWa("customer2") : openTel("customer2")
                  }
                >
                  زبون2
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {customWaPick && customPickPos ? (
        <div
          className="pointer-events-auto fixed z-[1001] flex w-[min(200px,calc(100vw-16px))] touch-manipulation flex-col gap-1 rounded-2xl border border-violet-200/90 bg-white p-2 shadow-xl"
          style={{ left: customPickMenuLeft, top: customPickMenuTop }}
          dir="rtl"
          role="menu"
          aria-label={`قالب واتساب — ${customWaPick.btn.label}`}
        >
          <p className="px-1 py-0.5 text-center text-xs font-bold text-slate-600">
            {customWaPick.btn.label}
          </p>
          <button
            type="button"
            role="menuitem"
            disabled={waShop === "#"}
            className={`flex min-h-[42px] touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white ${
              waShop === "#"
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-violet-700 hover:bg-violet-800"
            }`}
            onClick={() => openCustomWaToTarget(customWaPick.btn, "shop")}
          >
            <span aria-hidden>{customWaPick.btn.iconKey}</span>
            <span>{shopLabel}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={waCust === "#"}
            className={`flex min-h-[42px] touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white ${
              waCust === "#"
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-violet-600 hover:bg-violet-700"
            }`}
            onClick={() => openCustomWaToTarget(customWaPick.btn, "customer")}
          >
            <span aria-hidden>{customWaPick.btn.iconKey}</span>
            <span>زبون</span>
          </button>
          {hasCust2 ? (
            <button
              type="button"
              role="menuitem"
              disabled={waCust2 === "#"}
              className={`flex min-h-[42px] touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white ${
                waCust2 === "#"
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-violet-500/95 hover:bg-violet-600"
              }`}
              onClick={() => openCustomWaToTarget(customWaPick.btn, "customer2")}
            >
              <span aria-hidden>{customWaPick.btn.iconKey}</span>
              <span>زبون2</span>
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex min-h-[34px] touch-manipulation items-center justify-center rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
            onClick={() => setCustomWaPick(null)}
          >
            رجوع
          </button>
        </div>
      ) : null}

      {isExpanded && positions.wa && (
        <div
          className="pointer-events-auto fixed z-[1000] flex flex-col items-end gap-3 transition-all animate-in slide-in-from-bottom-4 duration-300"
          style={{
            left: positions.wa.left - 4,
            bottom: window.innerHeight - positions.wa.top + 12,
          }}
        >
          {editUrl && (
            <a
              href={editUrl}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-xl ring-2 ring-white/50 transition active:scale-95"
            >
              <span>📝</span>
              <span>تعديل الطلب</span>
            </a>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setContactMenu("wa");
                overlayDismissGuardUntilRef.current = Date.now() + 420;
              }}
              className="flex h-12 w-44 items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-xl ring-2 ring-white/50 transition active:scale-95"
            >
              <IconWa className="h-5 w-5" />
              <span>مراسلة واتساب</span>
            </button>

            <button
              onClick={() => {
                setContactMenu("tel");
                overlayDismissGuardUntilRef.current = Date.now() + 420;
              }}
              className="flex h-12 w-44 items-center justify-center gap-3 rounded-2xl bg-sky-500 text-sm font-black text-white shadow-xl ring-2 ring-white/50 transition active:scale-95"
            >
              <IconPhone className="h-5 w-5" />
              <span>اتصال هاتفي</span>
            </button>

            {(customWaButtons ?? []).map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  setCustomWaPick({ btn });
                  overlayDismissGuardUntilRef.current = Date.now() + 420;
                }}
                className="flex h-12 w-44 items-center justify-center gap-3 rounded-2xl bg-violet-600 text-sm font-black text-white shadow-xl ring-2 ring-white/50 transition active:scale-95"
              >
                <span className="text-lg">{btn.iconKey || "💬"}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {positions.wa ? (
        <DraggableFab
          fabId="wa"
          position={positions.wa}
          fabSize={fabSize}
          onPositionMove={movePosition}
          onDragEndPersist={persistPosition}
          zIndex={fabZ}
          title="أزرار التواصل — اضغط مطولاً لضبط حجم الأزرار"
          className={`${isExpanded ? "bg-rose-500" : "bg-indigo-600"} text-white shadow-2xl transition-colors duration-300`}
          onTap={() => {
            if (isExpanded) {
              setIsExpanded(false);
              setContactMenu(null);
              setCustomWaPick(null);
            } else {
              setIsExpanded(true);
              overlayDismissGuardUntilRef.current = Date.now() + 420;
            }
          }}
          onLongPress={openScalePanel}
        >
          <div className="flex items-center justify-center">
            {isExpanded ? (
              <svg className="h-8 w-8 animate-in spin-in-90 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <div className="flex flex-col items-center justify-center gap-0.5">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse delay-75"></div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-tighter">المهام</span>
              </div>
            )}
          </div>
        </DraggableFab>
      ) : null}
    </div>
  );
}
