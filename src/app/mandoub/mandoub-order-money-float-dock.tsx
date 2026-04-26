"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FAB_SIZE, loadFabScale } from "@/components/order-fab-dock";
import {
  MANDOUB_FAB_EVT_OPEN_SCALE_PANEL,
  MANDOUB_FAB_EVT_RESET_LAYOUT,
  MANDOUB_FAB_EVT_SCALE,
  MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY,
} from "@/lib/mandoub-fab-bridge";
import {
  clampMoneyFloatPos,
  defaultMoneyFloatPositions,
  type MoneyFloatId,
  type MoneyFloatPos,
  MONEY_FLOAT_DIMS,
  readMoneyFloatLayout,
  saveMoneyFloatLayout,
} from "./mandoub-money-float-storage";

const DRAG_THRESHOLD = 8;
const LONG_PRESS_MS = 650;
const Z_BTN = 1200;
const Z_PANEL = 1210;

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

type DragState = {
  startX: number;
  startY: number;
  origLeft: number;
  origTop: number;
  moved: boolean;
  last: MoneyFloatPos;
};

function useDragPersist(
  id: MoneyFloatId,
  pos: MoneyFloatPos,
  onMove: (p: MoneyFloatPos) => void,
  onFinalize: (p: MoneyFloatPos) => void,
  btnSize: number,
) {
  const dragRef = useRef<DragState | null>(null);
  const blockClickRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origLeft: pos.left,
        origTop: pos.top,
        moved: false,
        last: { ...pos },
      };
      blockClickRef.current = false;
    },
    [pos.left, pos.top],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        d.moved = true;
        blockClickRef.current = true;
      }
      if (!d.moved) return;
      const next = clampMoneyFloatPos(id, d.origLeft + dx, d.origTop + dy, btnSize);
      d.last = next;
      onMove(next);
    },
    [id, onMove, btnSize],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (d?.moved) {
        onFinalize(d.last);
        window.setTimeout(() => {
          blockClickRef.current = false;
        }, 0);
      }
    },
    [onFinalize],
  );

  return {
    onPointerDownCapture: onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    swallowClick: (ev: React.MouseEvent) => {
      if (blockClickRef.current) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
  };
}

function DraggableFloatButton({
  id,
  label,
  className,
  pos,
  fabSize,
  sizeScale = 1,
  onMove,
  onFinalize,
  onClick,
  onLongPress,
  disabled,
}: {
  id: MoneyFloatId;
  label: string;
  className: string;
  pos: MoneyFloatPos;
  fabSize: number;
  /** 1 = حجم موحّد مع بقية الأزرار؛ أقل من 1 يصغّر الزر (مثل «تم التسليم») */
  sizeScale?: number;
  onMove: (p: MoneyFloatPos) => void;
  onFinalize: (p: MoneyFloatPos) => void;
  onClick: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}) {
  const dragRef = useRef<DragState | null>(null);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const eff = fabSize * sizeScale;

  const clearLongPress = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const labelPx = Math.max(8, Math.round(eff * (sizeScale < 1 ? 0.2 : 0.21)));

  return (
    <div
      className="pointer-events-auto touch-none select-none"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: eff,
        height: eff,
        zIndex: Z_BTN,
        touchAction: "none",
      }}
      title="اسحب للتحريك — يُحفظ المكان لكل الطلبات — اضغط مطولاً لضبط حجم الأزرار"
      onPointerDownCapture={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        longPressFiredRef.current = false;
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origLeft: pos.left,
          origTop: pos.top,
          moved: false,
          last: { ...pos },
        };
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
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          d.moved = true;
          clearLongPress();
        }
        if (!d.moved) return;
        const next = clampMoneyFloatPos(id, d.origLeft + dx, d.origTop + dy, eff);
        d.last = next;
        onMove(next);
      }}
      onPointerUp={(e) => {
        clearLongPress();
        const d = dragRef.current;
        const skipTap = longPressFiredRef.current;
        longPressFiredRef.current = false;
        dragRef.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (!d) return;
        if (d.moved) {
          onFinalize(d.last);
          return;
        }
        if (skipTap) return;
        if (!disabled) onClick();
      }}
      onPointerCancel={(e) => {
        clearLongPress();
        dragRef.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(ev) => ev.preventDefault()}
        style={{ fontSize: labelPx }}
        className={`flex h-full w-full cursor-grab items-center justify-center rounded-full px-0.5 text-center font-black leading-tight shadow-lg ring-2 ring-white/30 active:cursor-grabbing disabled:opacity-50 ${className}`}
      >
        {label}
      </button>
    </div>
  );
}

function DraggableFloatPanel({
  id,
  pos,
  fabSize,
  onMove,
  onFinalize,
  onClose,
  children,
}: {
  id: MoneyFloatId;
  pos: MoneyFloatPos;
  fabSize: number;
  onMove: (p: MoneyFloatPos) => void;
  onFinalize: (p: MoneyFloatPos) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const drag = useDragPersist(id, pos, onMove, onFinalize, fabSize);

  return (
    <div
      className="pointer-events-auto touch-none select-none"
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: MONEY_FLOAT_DIMS.panelW,
        maxHeight: MONEY_FLOAT_DIMS.panelH,
        zIndex: Z_PANEL,
        touchAction: "none",
      }}
      dir="rtl"
      lang="ar"
    >
      <div
        className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-slate-400/40 bg-white/95 shadow-2xl ring-2 ring-slate-300/50 backdrop-blur-sm"
        style={{ maxHeight: `min(${MONEY_FLOAT_DIMS.panelH}px, 80vh)` }}
      >
        <div className="flex shrink-0 items-stretch justify-between gap-2 border-b border-slate-200 bg-slate-100/90">
          <div
            className="min-w-0 flex-1 cursor-grab px-3 py-2.5 active:cursor-grabbing"
            onPointerDownCapture={drag.onPointerDownCapture}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerCancel={drag.onPointerCancel}
          >
            <span className="text-xs font-bold leading-snug text-slate-600">
              اسحب من هنا للتحريك — يُحفظ المكان لكل الطلبات
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="pointer-events-auto shrink-0 self-stretch border-s border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 hover:bg-slate-50 active:bg-slate-100"
          >
            إغلاق
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
      </div>
    </div>
  );
}

function initialFabScale(): number {
  if (typeof window === "undefined") return 1;
  return loadFabScale(MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY);
}

function initialMoneyFloatPositions(fabSize: number): Record<MoneyFloatId, MoneyFloatPos> {
  if (typeof window === "undefined") return defaultMoneyFloatPositions();
  const saved = readMoneyFloatLayout();
  const base = saved ?? defaultMoneyFloatPositions();
  const next = { ...base };
  (Object.keys(next) as MoneyFloatId[]).forEach((id) => {
    next[id] = clampMoneyFloatPos(id, next[id].left, next[id].top, fabSize);
  });
  return next;
}

export function MandoubOrderMoneyFloatDock(props: {
  /** زر واحد بنفس الموضع: «تم الاستلام» (أصفر) أو «تم التسليم» (أخضر أصغر) */
  showStatusFab: boolean;
  statusFabMode: "pickedUp" | "delivered";
  onStatusFabClick: () => void;
  showPickupBtn: boolean;
  showDeliveryBtn: boolean;
  pickupDisabled?: boolean;
  deliveryDisabled?: boolean;
  pickupOpen: boolean;
  deliveryOpen: boolean;
  onOpenPickup: () => void;
  onOpenDelivery: () => void;
  onClosePanels: () => void;
  pickupForm: ReactNode;
  deliveryForm: ReactNode;
  /** إخفاء الأزرار العائمة (مثلاً أثناء تعديل الطلب من المجهز) */
  dockHidden?: boolean;
}) {
  const mounted = useMounted();
  const [fabScale, setFabScale] = useState(initialFabScale);
  const fabSize = FAB_SIZE * fabScale;
  const [positions, setPositions] = useState<Record<MoneyFloatId, MoneyFloatPos>>(() =>
    initialMoneyFloatPositions(FAB_SIZE * initialFabScale()),
  );
  const skipFabClampRef = useRef(true);

  useEffect(() => {
    const onScale = (e: Event) => {
      const ce = e as CustomEvent<{ storageKey?: string; scale?: number }>;
      if (ce.detail?.storageKey !== MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY) return;
      if (typeof ce.detail.scale === "number" && Number.isFinite(ce.detail.scale)) {
        setFabScale(ce.detail.scale);
      }
    };
    window.addEventListener(MANDOUB_FAB_EVT_SCALE, onScale);
    return () => window.removeEventListener(MANDOUB_FAB_EVT_SCALE, onScale);
  }, []);

  useEffect(() => {
    const onReset = (e: Event) => {
      const ce = e as CustomEvent<{ storageKey?: string }>;
      if (ce.detail?.storageKey !== MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY) return;
      const defs = defaultMoneyFloatPositions();
      const next = { ...defs };
      (Object.keys(next) as MoneyFloatId[]).forEach((id) => {
        next[id] = clampMoneyFloatPos(id, next[id].left, next[id].top, fabSize);
      });
      setPositions(next);
      saveMoneyFloatLayout(next);
    };
    window.addEventListener(MANDOUB_FAB_EVT_RESET_LAYOUT, onReset);
    return () => window.removeEventListener(MANDOUB_FAB_EVT_RESET_LAYOUT, onReset);
  }, [fabSize]);

  useEffect(() => {
    if (skipFabClampRef.current) {
      skipFabClampRef.current = false;
      return;
    }
    setPositions((prev) => {
      const next = { ...prev };
      (Object.keys(next) as MoneyFloatId[]).forEach((id) => {
        next[id] = clampMoneyFloatPos(id, next[id].left, next[id].top, fabSize);
      });
      saveMoneyFloatLayout(next);
      return next;
    });
  }, [fabSize]);

  useEffect(() => {
    const onResize = () => {
      setPositions((prev) => {
        const next = { ...prev };
        (Object.keys(next) as MoneyFloatId[]).forEach((id) => {
          next[id] = clampMoneyFloatPos(id, next[id].left, next[id].top, fabSize);
        });
        saveMoneyFloatLayout(next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fabSize]);

  const openFabScalePanel = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(MANDOUB_FAB_EVT_OPEN_SCALE_PANEL, {
        detail: { storageKey: MANDOUB_ORDER_FAB_LAYOUT_STORAGE_KEY },
      }),
    );
  }, []);

  const moveOne = useCallback((id: MoneyFloatId, p: MoneyFloatPos) => {
    setPositions((prev) => ({ ...prev, [id]: p }));
  }, []);

  const finalizeOne = useCallback((id: MoneyFloatId, p: MoneyFloatPos) => {
    setPositions((prev) => {
      const next = { ...prev, [id]: p };
      saveMoneyFloatLayout(next);
      return next;
    });
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  if (props.dockHidden) return null;

  const panelOpen = props.pickupOpen || props.deliveryOpen;

  const statusPickedUp = props.showStatusFab && props.statusFabMode === "pickedUp";
  const statusDelivered = props.showStatusFab && props.statusFabMode === "delivered";

  return createPortal(
    <>
      {statusPickedUp ? (
        <DraggableFloatButton
          id="statusBtn"
          label={"📦\nتم\nالاستلام"}
          className="whitespace-pre-line border-2 border-amber-700 bg-amber-400 text-amber-950 hover:bg-amber-500"
          pos={positions.statusBtn}
          fabSize={fabSize}
          onMove={(p) => moveOne("statusBtn", p)}
          onFinalize={(p) => finalizeOne("statusBtn", p)}
          onClick={() => props.onStatusFabClick()}
          onLongPress={openFabScalePanel}
        />
      ) : null}
      {statusDelivered ? (
        <DraggableFloatButton
          id="statusBtn"
          label={"✓\nتم\nالتسليم"}
          className="whitespace-pre-line border-2 border-red-900 bg-red-600 text-white hover:bg-red-700"
          pos={positions.statusBtn}
          fabSize={fabSize}
          onMove={(p) => moveOne("statusBtn", p)}
          onFinalize={(p) => finalizeOne("statusBtn", p)}
          onClick={() => props.onStatusFabClick()}
          onLongPress={openFabScalePanel}
        />
      ) : null}
      {props.showPickupBtn ? (
        <DraggableFloatButton
          id="pickupBtn"
          label={"💸\nدفع\nللعميل"}
          className="whitespace-pre-line bg-emerald-600 text-white hover:bg-emerald-700"
          pos={positions.pickupBtn}
          fabSize={fabSize}
          onMove={(p) => moveOne("pickupBtn", p)}
          onFinalize={(p) => finalizeOne("pickupBtn", p)}
          onClick={() => props.onOpenPickup()}
          onLongPress={openFabScalePanel}
          disabled={props.pickupDisabled}
        />
      ) : null}
      {props.showDeliveryBtn ? (
        <DraggableFloatButton
          id="deliveryBtn"
          label={"🫴\nاستلام\nمن الزبون"}
          className="whitespace-pre-line bg-red-600 text-white hover:bg-red-700"
          pos={positions.deliveryBtn}
          fabSize={fabSize}
          onMove={(p) => moveOne("deliveryBtn", p)}
          onFinalize={(p) => finalizeOne("deliveryBtn", p)}
          onClick={() => props.onOpenDelivery()}
          onLongPress={openFabScalePanel}
          disabled={props.deliveryDisabled}
        />
      ) : null}
      {panelOpen ? (
        <DraggableFloatPanel
          id="moneyPanel"
          pos={positions.moneyPanel}
          fabSize={fabSize}
          onMove={(p) => moveOne("moneyPanel", p)}
          onFinalize={(p) => finalizeOne("moneyPanel", p)}
          onClose={props.onClosePanels}
        >
          {props.pickupOpen ? props.pickupForm : props.deliveryForm}
        </DraggableFloatPanel>
      ) : null}
    </>,
    document.body,
  );
}
