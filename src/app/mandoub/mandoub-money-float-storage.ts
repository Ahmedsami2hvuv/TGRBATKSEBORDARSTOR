import { FAB_SIZE } from "@/components/order-fab-dock";

export type MoneyFloatPos = { left: number; top: number };

export const MANDOUB_MONEY_FLOAT_STORAGE_KEY = "mandoub_money_float_ui_v3";

/** أزرار عائمة: حالة (تم استلام/تسليم) + دفع للعميل + استلام من الزبون + لوحة المبلغ */
export type MoneyFloatId = "statusBtn" | "pickupBtn" | "deliveryBtn" | "moneyPanel";

const PANEL_W = 340;
const PANEL_H = 400;

/** قياس افتراضي لحساب المواضع الأولى (معامل التكبير = 1) — يطابق أزرار الواتساب/الاتصال */
const BTN_BASE = FAB_SIZE;

export function defaultMoneyFloatPositions(): Record<MoneyFloatId, MoneyFloatPos> {
  if (typeof window === "undefined") {
    return {
      statusBtn: { left: 0, top: 0 },
      pickupBtn: { left: 0, top: 0 },
      deliveryBtn: { left: 0, top: 0 },
      moneyPanel: { left: 0, top: 0 },
    };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const m = 12;
  const stackY = 160;
  const gap = 14;
  return {
    /** أعلى العمود — نفس الموضع لـ «تم الاستلام» ثم «تم التسليم» */
    statusBtn: {
      left: w - m - BTN_BASE,
      top: h - m - BTN_BASE * 3 - gap * 2 - stackY,
    },
    pickupBtn: { left: w - m - BTN_BASE, top: h - m - BTN_BASE * 2 - gap - stackY },
    deliveryBtn: { left: w - m - BTN_BASE, top: h - m - BTN_BASE - stackY },
    moneyPanel: {
      left: Math.max(m, Math.min(w - m - PANEL_W, (w - PANEL_W) / 2)),
      top: Math.max(m, 72),
    },
  };
}

export function readMoneyFloatLayout(): Record<MoneyFloatId, MoneyFloatPos> | null {
  if (typeof window === "undefined") return null;
  const defs = defaultMoneyFloatPositions();
  try {
    const raw = localStorage.getItem(MANDOUB_MONEY_FLOAT_STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const out: Partial<Record<MoneyFloatId, MoneyFloatPos>> = {};
      for (const id of ["statusBtn", "pickupBtn", "deliveryBtn", "moneyPanel"] as MoneyFloatId[]) {
        const p = o[id];
        if (
          p &&
          typeof p === "object" &&
          typeof (p as MoneyFloatPos).left === "number" &&
          typeof (p as MoneyFloatPos).top === "number"
        ) {
          out[id] = { left: (p as MoneyFloatPos).left, top: (p as MoneyFloatPos).top };
        }
      }
      if (Object.keys(out).length > 0) {
        return {
          statusBtn: out.statusBtn ?? defs.statusBtn,
          pickupBtn: out.pickupBtn ?? defs.pickupBtn,
          deliveryBtn: out.deliveryBtn ?? defs.deliveryBtn,
          moneyPanel: out.moneyPanel ?? defs.moneyPanel,
        };
      }
    }
  } catch {
    /* fall through to v2 */
  }
  try {
    const raw = localStorage.getItem("mandoub_money_float_ui_v2");
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const pickup = o.pickupBtn as MoneyFloatPos | undefined;
    const delivery = o.deliveryBtn as MoneyFloatPos | undefined;
    const panel = o.moneyPanel as MoneyFloatPos | undefined;
    if (
      !pickup ||
      typeof pickup.left !== "number" ||
      typeof pickup.top !== "number" ||
      !delivery ||
      typeof delivery.left !== "number" ||
      typeof delivery.top !== "number"
    ) {
      return null;
    }
    return {
      statusBtn: defs.statusBtn,
      pickupBtn: pickup,
      deliveryBtn: delivery,
      moneyPanel:
        panel && typeof panel.left === "number" && typeof panel.top === "number"
          ? panel
          : defs.moneyPanel,
    };
  } catch {
    return null;
  }
}

export function saveMoneyFloatLayout(pos: Record<MoneyFloatId, MoneyFloatPos>) {
  try {
    localStorage.setItem(MANDOUB_MONEY_FLOAT_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export function clampMoneyFloatPos(
  id: MoneyFloatId,
  left: number,
  top: number,
  btnSize: number,
): MoneyFloatPos {
  if (typeof window === "undefined") return { left, top };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const m = 4;
  const boxW = id === "moneyPanel" ? PANEL_W : btnSize;
  const boxH = id === "moneyPanel" ? PANEL_H : btnSize;
  return {
    left: Math.max(m, Math.min(left, w - m - boxW)),
    top: Math.max(m, Math.min(top, h - m - boxH)),
  };
}

export const MONEY_FLOAT_DIMS = {
  panelW: PANEL_W,
  panelH: PANEL_H,
} as const;
